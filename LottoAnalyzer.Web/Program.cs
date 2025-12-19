using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using LottoAnalyzer.Web;
using LottoAnalyzer.Core.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<LottoDataService>();
builder.Services.AddScoped<StatisticsService>();
builder.Services.AddScoped<RecommendationService>();

await builder.Build().RunAsync();
