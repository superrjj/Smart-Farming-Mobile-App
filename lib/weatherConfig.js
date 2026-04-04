import { fetchWeatherApi } from "openmeteo";

// Export async function that accepts coordinates
export async function getWeatherData(latitude = 15.4753, longitude = 120.5983) {
  const params = {
    latitude,
    longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "wind_speed_10m",
      "precipitation",
      "weather_code",
      "rain",
    ],
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "uv_index_max",
    ],
    timezone: "Asia/Manila",
    forecast_days: 7,
  };

  const url = "https://api.open-meteo.com/v1/forecast";

  try {
    const responses = await fetchWeatherApi(url, params);
    const response = responses[0];

    const current = response.current();
    const daily = response.daily();

    const weatherData = {
      latitude: response.latitude(),
      longitude: response.longitude(),
      current: {
        time: new Date(Number(current.time()) * 1000),
        temperature_2m: current.variables(0).value(),
        relative_humidity_2m: current.variables(1).value(),
        apparent_temperature: current.variables(2).value(),
        is_day: current.variables(3).value(),
        wind_speed_10m: current.variables(4).value(),
        precipitation: current.variables(5).value(),
        weather_code: current.variables(6).value(),
        rain: current.variables(7).value(),
      },
      daily: {
        time: range(
          Number(daily.time()),
          Number(daily.timeEnd()),
          daily.interval(),
        ).map((t) => new Date(t * 1000)),
        weather_code: daily.variables(0).valuesArray(),
        temperature_2m_max: daily.variables(1).valuesArray(),
        temperature_2m_min: daily.variables(2).valuesArray(),
        precipitation_sum: daily.variables(3).valuesArray(),
        uv_index_max: daily.variables(4).valuesArray(),
      },
    };

    return weatherData;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error;
  }
}

// Helper function to form time ranges
function range(start, stop, step) {
  return Array.from(
    { length: (stop - start) / step },
    (_, i) => start + i * step,
  );
}
