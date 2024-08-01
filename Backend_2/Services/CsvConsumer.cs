using System;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using MySql.Data.MySqlClient;
using Newtonsoft.Json;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using Shared.Models;
using Shared.Services;

namespace InfoCSV.Receiver.Services
{
    public class CsvConsumer : BackgroundService
    {
        private readonly string _connectionString;
        private readonly IMongoCollection<FileState> _mongoCollection;
        private IConnection _connection;
        private IModel _channel;
        private readonly ILogger<CsvConsumer> _logger;
        private readonly FileStateService _fileStateService;

        public CsvConsumer(IConfiguration configuration, ILogger<CsvConsumer> logger, FileStateService fileStateService)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")
                               ?? throw new ArgumentNullException(nameof(configuration), "Connection string 'DefaultConnection' is missing or null.");
            _logger = logger;
            _fileStateService = fileStateService;

            var factory = new ConnectionFactory() { HostName = "localhost" };
            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();
            _channel.QueueDeclare(queue: "csv_queue",
                                 durable: false,
                                 exclusive: false,
                                 autoDelete: false,
                                 arguments: null);

            // MongoDB setup
            var mongoClient = new MongoClient(configuration.GetConnectionString("MongoDbConnection"));
            var mongoDatabase = mongoClient.GetDatabase("fileuploads");
            _mongoCollection = mongoDatabase.GetCollection<FileState>("file_states");
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var consumer = new EventingBasicConsumer(_channel);
            consumer.Received += async (model, ea) =>
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);

                try
                {
                    var jsonMessage = JsonConvert.DeserializeObject<dynamic>(message);
                    var fileId = (string)jsonMessage.FileId;
                    var dataTable = JsonConvert.DeserializeObject<DataTable>(jsonMessage.Data.ToString());

                    // Initial state tracking
                    await UpdateFileStateAsync(fileId, "Received", progressMessage: "Uploaded");

                    await BulkInsertAsync(dataTable, fileId);
                    await _fileStateService.UpdateFileStateAsync(fileId, "Uploaded");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing message");
                }
            };

            _channel.BasicConsume(queue: "csv_queue",
                                 autoAck: true,
                                 consumer: consumer);

            stoppingToken.Register(() =>
            {
                _logger.LogInformation("Stopping CsvConsumer background service.");
            });

            return Task.CompletedTask;
        }

        public override void Dispose()
        {
            _channel.Close();
            _connection.Close();
            base.Dispose();
        }

        private async Task BulkInsertAsync(DataTable? dataTable, string fileId)
        {
            if (dataTable == null)
            {
                throw new ArgumentNullException(nameof(dataTable), "The DataTable parameter cannot be null.");
            }

            var totalRows = dataTable.Rows.Count;
            var batchSize = 10000;
            var processedRows = 0;

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            using (var connection = new MySqlConnection(_connectionString))
            {
                await connection.OpenAsync();

                using (var transaction = await connection.BeginTransactionAsync())
                {
                    try
                    {
                        var columns = string.Join(",", dataTable.Columns.Cast<DataColumn>().Select(c => c.ColumnName));
                        var updateColumns = string.Join(",", dataTable.Columns.Cast<DataColumn>().Select(c => $"{c.ColumnName}=VALUES({c.ColumnName})"));

                        for (int i = 0; i < totalRows; i += batchSize)
                        {
                            var batchRows = dataTable.AsEnumerable().Skip(i).Take(batchSize);
                            var valuesList = new StringBuilder();

                            foreach (var row in batchRows)
                            {
                                var values = string.Join(",", dataTable.Columns.Cast<DataColumn>().Select(c => $"'{MySqlHelper.EscapeString(row[c].ToString())}'"));
                                valuesList.Append($"({values}),");
                            }

                            if (valuesList.Length > 0)
                            {
                                valuesList.Length--; // Remove the trailing comma
                                var commandText = $"INSERT INTO users ({columns}) VALUES {valuesList} ON DUPLICATE KEY UPDATE {updateColumns};";

                                using (var cmd = new MySqlCommand(commandText, connection, (MySqlTransaction)transaction))
                                {
                                    _logger.LogInformation("Executing batch insert command.");
                                    await cmd.ExecuteNonQueryAsync();
                                }
                            }

                            processedRows += batchRows.Count();
                            var progress = (double)processedRows / totalRows * 100;
                            _logger.LogInformation($"Progress: {progress:F2}%");

                            // Update progress in MongoDB
                            await UpdateFileStateAsync(fileId, "Processing", $"Progress: {progress:F2}%", processedRows);
                        }

                        await transaction.CommitAsync();
                        stopwatch.Stop();
                        var elapsedMilliseconds = stopwatch.ElapsedMilliseconds;
                        _logger.LogInformation($"Message processed in {elapsedMilliseconds} ms");

                        // Final update to mark the file as processed
                        await UpdateFileStateAsync(fileId, "Processed", batchesProcessed: processedRows);
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogError(ex, "Error during bulk insert, rolling back transaction.");
                        await UpdateFileStateAsync(fileId, "Error", progressMessage: ex.Message);
                        throw;
                    }
                }
            }
        }

        private async Task UpdateFileStateAsync(string fileId, string state, string? progressMessage = null, int batchesProcessed = 0, Batch? currentBatch = null)
        {
            _logger.LogInformation($"Updating file state for fileId: {fileId} to state: {state}");

            var filter = Builders<FileState>.Filter.Eq(fs => fs.FileId, fileId);
            var update = Builders<FileState>.Update.Set(fs => fs.FileStatus, state)
                                                   .Set(fs => fs.IsProcessed, state.Equals("Processed", StringComparison.OrdinalIgnoreCase))
                                                   .Set(fs => fs.DateProcessed, DateTime.UtcNow)
                                                   .Set(fs => fs.BatchesProcessed, batchesProcessed);

            if (currentBatch != null)
            {
                update = update.Push(fs => fs.Batches, currentBatch)
                               .Inc(fs => fs.BatchCount, 1);
            }

            var updateOptions = new UpdateOptions { IsUpsert = true };
            var updateResult = await _mongoCollection.UpdateOneAsync(filter, update, updateOptions);

            if (updateResult.IsAcknowledged)
            {
                _logger.LogInformation("File state updated successfully for fileId: {fileId}, state: {state}, BatchesProcessed: {batchesProcessed}", fileId, state, batchesProcessed);
            }
            else
            {
                _logger.LogWarning("Failed to update file state for fileId: {fileId}", fileId);
            }
        }
    }
}
