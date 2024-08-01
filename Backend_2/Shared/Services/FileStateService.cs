using MongoDB.Driver;
using Shared.Models;


namespace Shared.Services
{
    public class FileStateService
    {
        private readonly IMongoCollection<FileState> _mongoCollection;
        private readonly ILogger<FileStateService> _logger;

        public FileStateService(IMongoDatabase mongoDatabase, ILogger<FileStateService> logger)
        {
            _mongoCollection = mongoDatabase.GetCollection<FileState>("fileStates");
            _logger = logger;
        }

        public async Task InsertFileStateAsync(FileState fileState)
        {
            await _mongoCollection.InsertOneAsync(fileState);
            _logger.LogInformation($"File state inserted for FileId: {fileState.FileId}");
        }

        public async Task UpdateFileStateAsync(string fileId, string state)
        {
            _logger.LogInformation($"Updating file state for fileId: {fileId} to state: {state}");
            
            var filter = Builders<FileState>.Filter.Eq(fs => fs.FileId, fileId);
            var update = Builders<FileState>.Update
                .Set(fs => fs.FileStatus, state)
                .Set(fs => fs.IsProcessed, true)
                .Set(fs => fs.DateProcessed, DateTime.UtcNow)
                .Inc(s => s.BatchCount, 1);
            // if (currentBatch != null)
            // {
            //     update = update.Push(fs => fs.Batches, currentBatch)
            //                    .Inc(fs => fs.BatchCount, 1);
            // }



            // var updateOptions = new UpdateOptions { IsUpsert = true };
            var updateResult = await _mongoCollection.UpdateOneAsync(filter, update);

            if (updateResult.IsAcknowledged)
            {
                _logger.LogInformation($"File state updated successfully for fileId: {fileId}, state: {state}");
                var updatedFileState = await _mongoCollection.Find(filter).FirstOrDefaultAsync();
                if (updatedFileState != null)
                {
                    // Log or process the final parameters as needed
                    _logger.LogInformation($"Final parameters for fileId: {fileId} - FileStatus: {updatedFileState.FileStatus}, IsProcessed: {updatedFileState.IsProcessed}, DateProcessed: {updatedFileState.DateProcessed}");
                }
            }
            else
            {
                _logger.LogWarning($"Failed to update file state for fileId: {fileId}");
            }
        }
    }
}
