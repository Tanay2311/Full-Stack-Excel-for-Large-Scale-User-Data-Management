using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;

namespace Shared.Models
{
    public class Batch
    {
        [BsonElement("BId")]
        public string BId { get; set; } = string.Empty;

        [BsonElement("BatchStatus")]
        public string BatchStatus { get; set; } = string.Empty;

        [BsonElement("BatchStart")]
        public int BatchStart { get; set; }

        [BsonElement("BatchEnd")]
        public int BatchEnd { get; set; }
    }

    public class FileState
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public ObjectId Id { get; set; }

        public string FileId { get; set; }= string.Empty;

        public string FileName { get; set; } = string.Empty;

        public string FileStatus { get; set; } = string.Empty;

        public bool IsProcessed { get; set; }

        [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
        public DateTime DateProcessed { get; set; }

        public int BatchesProcessed { get; set; }

        [BsonElement("TotalBatches")]
        public int TotalBatches { get; set; }

        [BsonElement("BatchCount")]
        public int BatchCount { get; set; }

        [BsonElement("Batches")]
        public List<Batch> Batches { get; set; } = new List<Batch>();
    }
}
