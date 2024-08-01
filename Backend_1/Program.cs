using Microsoft.OpenApi.Models;
using MySql.Data.MySqlClient;
using MongoDB.Driver;
using Shared.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers(); // Ensure this line is present
builder.Logging.AddConsole();

// Add CORS services
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllOrigins",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

// Retrieve connection strings from configuration
string? mySqlConnectionStr = builder.Configuration.GetConnectionString("DefaultConnection");
string? mongoDbConnectionStr = builder.Configuration.GetConnectionString("MongoDbConnection");
string? mongoDbDatabaseName = builder.Configuration.GetSection("MongoDbSettings:DatabaseName").Value;

// Check for null connection strings
if (mySqlConnectionStr == null)
{
    throw new InvalidOperationException("Connection string 'DefaultConnection' not found in configuration.");
}

if (mongoDbConnectionStr == null)
{
    throw new InvalidOperationException("Connection string 'MongoDbConnection' not found in configuration.");
}

if (mongoDbDatabaseName == null)
{
    throw new InvalidOperationException("MongoDB database name not found in configuration.");
}

// Register MySQL connection as a singleton
builder.Services.AddSingleton(new MySqlConnection(mySqlConnectionStr));

// Register MongoDB services
builder.Services.AddSingleton<IMongoClient>(sp => new MongoClient(mongoDbConnectionStr));
builder.Services.AddScoped<IMongoDatabase>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    return client.GetDatabase(mongoDbDatabaseName);
});

// Register FileStateService as a scoped service
builder.Services.AddScoped<FileStateService>();

// Configure Swagger for API documentation
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "My API", Version = "v1" });
});

var app = builder.Build();

// Ensure that middleware configuration allows for attribute-based routing and other required middlewares
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();
app.UseAuthorization();

app.UseCors("AllowAllOrigins");
app.UseCors("AllowAll");

app.MapControllers(); 

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "My API V1");
});

app.Run();
