using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;
using System.Data;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using RabbitMQ.Client;
using System.Diagnostics;
using Newtonsoft.Json;
using MongoDB.Driver;
using MongoDB.Bson;
using Shared.Models;
using Shared.Services;

namespace InfoCSV.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase, IDisposable
    {
        private readonly string _mySqlConnectionStr;
        private readonly IConnection _rabbitMqConnection;
        private readonly IModel _rabbitMqChannel;
        private readonly ILogger<UsersController> _logger;
        private readonly FileStateService _fileStateService;

        private const string CsvQueueName = "csv_queue";

        public UsersController(MySqlConnection mySqlConnection, IMongoDatabase mongoDatabase, ILogger<UsersController> logger, FileStateService fileStateService)
        {
            _mySqlConnectionStr = mySqlConnection.ConnectionString;
            _logger = logger;
            _fileStateService = fileStateService;

            var factory = new ConnectionFactory() { HostName = "localhost" };
            _rabbitMqConnection = factory.CreateConnection();
            _rabbitMqChannel = _rabbitMqConnection.CreateModel();
            _rabbitMqChannel.QueueDeclare(queue: CsvQueueName,
                                          durable: false,
                                          exclusive: false,
                                          autoDelete: false,
                                          arguments: null);
        }

        [HttpGet]
        public IActionResult TestDatabaseConnection()
        {
            try
            {
                using (var connection = new MySqlConnection(_mySqlConnectionStr))
                {
                    connection.Open();
                    connection.Close();
                }
                _logger.LogInformation("MySQL database connection test successful.");
                return Ok("MySQL database connection test successful.");
            }
            catch (Exception ex)
            {
                _logger.LogError($"MySQL database connection error: {ex.Message}");
                return StatusCode(500, $"MySQL database connection error: {ex.Message}");
            }
        }

        [HttpGet("fetch")]
        public IActionResult FetchAllData(int startRow = 0, int endRow = 20)
        {
            try
            {
                DataTable dataTable = new DataTable();

                using (var connection = new MySqlConnection(_mySqlConnectionStr))
                {
                    connection.Open();
                    string query = $"SELECT * FROM users LIMIT {startRow}, {endRow - startRow}";
                    using (var command = new MySqlCommand(query, connection))
                    using (var adapter = new MySqlDataAdapter(command))
                    {
                        adapter.Fill(dataTable);
                    }
                    connection.Close();
                }

                var dataList = new List<Dictionary<string, object>>();
                foreach (DataRow row in dataTable.Rows)
                {
                    var dataRow = new Dictionary<string, object>();
                    foreach (DataColumn col in dataTable.Columns)
                    {
                        dataRow.Add(col.ColumnName, row[col]);
                    }
                    dataList.Add(dataRow);
                }

                return Ok(new { data = dataList, total = GetTotalRowCount() });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching data from MySQL: {ex.Message}");
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        private int GetTotalRowCount()
        {
            using (var connection = new MySqlConnection(_mySqlConnectionStr))
            {
                connection.Open();
                string query = "SELECT COUNT(*) FROM users";
                using (var command = new MySqlCommand(query, connection))
                {
                    return Convert.ToInt32(command.ExecuteScalar());
                }
            }
        }

        [HttpGet("search/{header}/{data}")]
        public IActionResult searchData(string header, string data)
        {
            try
            {
                DataTable dataTable = new DataTable();

                using (var connection = new MySqlConnection(_mySqlConnectionStr))
                {
                    connection.Open();
                    string query = $"SELECT * FROM users WHERE {header} = @data";
                    using (var command = new MySqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@data", data);
                        using (var adapter = new MySqlDataAdapter(command))
                        {
                            adapter.Fill(dataTable);
                        }
                    }
                }

                var dataList = new List<Dictionary<string, object>>();
                foreach (DataRow row in dataTable.Rows)
                {
                    var dataRow = new Dictionary<string, object>();
                    foreach (DataColumn col in dataTable.Columns)
                    {
                        dataRow.Add(col.ColumnName, row[col]);
                    }
                    dataList.Add(dataRow);
                }

                return Ok(new { data = dataList, total = dataTable.Rows.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error fetching data from MySQL: {ex.Message}");
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }




        [HttpPut("data/{row}/{cell}")]
        public async Task<IActionResult> UpdateCell(int row, string cell, [FromBody] UpdateRequest request)
        {
            try
            {
                using (var connection = new MySqlConnection(_mySqlConnectionStr))
                {
                    await connection.OpenAsync();

                    _logger.LogInformation("Updating row {Row} cell {Cell} with value {Value}", row, cell, request.Value);

                    string query = "UPDATE users SET `" + cell + "` = @newValue WHERE id = @row";

                    using (var command = new MySqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@newValue", request.Value);
                        command.Parameters.AddWithValue("@row", row);

                        int rowsAffected = await command.ExecuteNonQueryAsync();

                        if (rowsAffected > 0)
                        {
                            return Ok(new { success = true });
                        }
                        else
                        {
                            return NotFound(new { success = false, message = "Row not found" });
                        }
                    }
                }
            }
            catch (MySqlException ex) when (ex.Number == 1062)
            {
                return BadRequest(new { success = false, message = "This email address is already in use." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while updating the cell.");
                return StatusCode(500, new { success = false, message = "An error occurred while processing your request." });
            }
        }

        public class UpdateRequest
        {
            public string? Value { get; set; }
        }

        [HttpPut("find_replace")]
        public async Task<IActionResult> FindAndReplace([FromBody] FindReplaceRequest request)
        {
            try
            {
                using (var connection = new MySqlConnection(_mySqlConnectionStr))
                {
                    await connection.OpenAsync();
                    string query = $"UPDATE users SET `{request.Column}` = @newValue WHERE `{request.Column}` = @oldValue";
                    using (var command = new MySqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@newValue", request.NewValue);
                        command.Parameters.AddWithValue("@oldValue", request.OldValue);

                        int rowsAffected = await command.ExecuteNonQueryAsync();

                        if (rowsAffected > 0)
                        {
                            return Ok(new { success = true, message = "Values updated successfully", rowsAffected });
                        }
                        else
                        {
                            return NotFound(new { success = false, message = "No matching records found" });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error during find and replace: {ex.Message}");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        public class FindReplaceRequest
        {
            public string? Column { get; set; }
            public string? OldValue { get; set; }
            public string? NewValue { get; set; }
        }






        [HttpDelete("delete")]
        public IActionResult DeleteByEmail(string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest("Email ID is required.");
            }

            try
            {
                using (var connection = new MySqlConnection(_mySqlConnectionStr))
                {
                    connection.Open();
                    string query = "DELETE FROM users WHERE email_id = @Email";
                    using (var command = new MySqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@Email", email);
                        int rowsAffected = command.ExecuteNonQuery();
                        connection.Close();

                        if (rowsAffected > 0)
                        {
                            _logger.LogInformation($"Record with Email ID {email} deleted successfully from MySQL.");
                            return Ok($"Record with Email ID {email} deleted successfully from MySQL.");
                        }
                        else
                        {
                            _logger.LogWarning($"No record found with Email ID {email} in MySQL.");
                            return NotFound($"No record found with Email ID {email} in MySQL.");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error deleting data from MySQL: {ex.Message}");
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadCsv(IFormFile file)
        {
            var stopwatch = Stopwatch.StartNew();

            if (file == null || file.Length == 0)
            {
                _logger.LogError("No file uploaded.");
                return BadRequest(new { success = false, message = "No file uploaded." });
            }

            try
            {
                var dataTable = new DataTable();
                using (var reader = new StreamReader(file.OpenReadStream()))
                using (var csv = new CsvReader(reader, new CsvConfiguration(System.Globalization.CultureInfo.CurrentCulture)))
                {
                    using (var dr = new CsvDataReader(csv))
                    {
                        dataTable.Load(dr);
                    }
                }

                var fileId = file.GetHashCode();
                var fileState = new FileState
                {
                    FileId = fileId.ToString(),
                    FileName = file.FileName,
                    FileStatus = "Uploaded",
                    IsProcessed = false,
                    DateProcessed = DateTime.Now,
                    BatchesProcessed = 0,
                    TotalBatches = (int)Math.Ceiling((double)dataTable.Rows.Count / 10000)
                };

                await _fileStateService.InsertFileStateAsync(fileState);

                var message = new
                {
                    FileId = fileId,
                    Data = dataTable
                };

                var json = JsonConvert.SerializeObject(message);
                var body = Encoding.UTF8.GetBytes(json);
                _rabbitMqChannel.BasicPublish(exchange: "",
                                              routingKey: CsvQueueName,
                                              basicProperties: null,
                                              body: body);

                stopwatch.Stop();
                var elapsedMilliseconds = stopwatch.ElapsedMilliseconds;
                _logger.LogInformation($"Uploaded file processed in {elapsedMilliseconds} ms");
                await _fileStateService.UpdateFileStateAsync(fileState.FileId, "Queued");
                return Ok(new { success = true, message = "Data uploaded and queued successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Internal server error: {ex.Message}");
                return StatusCode(500, new { success = false, message = $"Internal server error: {ex.Message}" });
            }
        }

        public void Dispose()
        {
            _rabbitMqChannel?.Close();
            _rabbitMqConnection?.Close();
            _rabbitMqChannel?.Dispose();
            _rabbitMqConnection?.Dispose();
        }
    }
}
