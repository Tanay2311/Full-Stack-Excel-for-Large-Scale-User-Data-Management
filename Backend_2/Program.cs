using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using MySql.Data.MySqlClient;
using InfoCSV.Receiver.Services; 
using MongoDB.Driver;
using Shared.Services;

var builder = Host.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration((context, config) =>
    {
        config.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
        config.AddEnvironmentVariables();
    })
    .ConfigureServices((context, services) =>
    {
        services.AddLogging();

        // Retrieve MySQL connection string
        string? mySqlConnectionString = context.Configuration.GetConnectionString("DefaultConnection");
        if (mySqlConnectionString == null)
        {
            throw new InvalidOperationException("Connection string 'DefaultConnection' not found in configuration.");
        }

        // Register MySQL connection as a singleton
        services.AddSingleton(new MySqlConnection(mySqlConnectionString));

        // Retrieve MongoDB connection string
        string? mongoConnectionString = context.Configuration.GetConnectionString("MongoDbConnection");
        if (mongoConnectionString == null)
        {
            throw new InvalidOperationException("Connection string 'MongoDbConnection' not found in configuration.");
        }

        // Register MongoDB client as a singleton
        var mongoClient = new MongoClient(mongoConnectionString);
        services.AddSingleton(mongoClient);
        services.AddScoped(sp => mongoClient.GetDatabase("fileuploads"));

        // Register FileStateService as a scoped service
        services.AddScoped<FileStateService>();

        // Register the CsvConsumer as a hosted service
        services.AddHostedService<CsvConsumer>();
    });

await builder.RunConsoleAsync();
