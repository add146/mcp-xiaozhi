"""
Weather MCP Server - Provides weather information for Xiaozhi
Uses Open-Meteo free API (no API key required)
"""
import json
import os
from fastmcp import FastMCP
import urllib.request
import urllib.parse
from typing import Optional

# Initialize FastMCP server
mcp = FastMCP("Weather Server")


def get_coordinates(city: str) -> tuple:
    """Get latitude and longitude for a city using Open-Meteo geocoding"""
    try:
        url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(city)}&count=1"
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            if data.get('results'):
                result = data['results'][0]
                return result['latitude'], result['longitude'], result.get('name', city)
    except Exception as e:
        print(f"Geocoding error: {e}")
    return None, None, city


def get_weather_data(lat: float, lon: float) -> dict:
    """Get weather data from Open-Meteo API"""
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
            f"&timezone=auto&forecast_days=3"
        )
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Weather API error: {e}")
    return None


def weather_code_to_description(code: int) -> str:
    """Convert WMO weather code to description"""
    codes = {
        0: "☀️ Clear sky",
        1: "🌤️ Mainly clear",
        2: "⛅ Partly cloudy",
        3: "☁️ Overcast",
        45: "🌫️ Foggy",
        48: "🌫️ Depositing rime fog",
        51: "🌧️ Light drizzle",
        53: "🌧️ Moderate drizzle",
        55: "🌧️ Dense drizzle",
        61: "🌧️ Slight rain",
        63: "🌧️ Moderate rain",
        65: "🌧️ Heavy rain",
        71: "🌨️ Slight snow",
        73: "🌨️ Moderate snow",
        75: "❄️ Heavy snow",
        77: "🌨️ Snow grains",
        80: "🌦️ Slight rain showers",
        81: "🌦️ Moderate rain showers",
        82: "⛈️ Violent rain showers",
        85: "🌨️ Slight snow showers",
        86: "🌨️ Heavy snow showers",
        95: "⛈️ Thunderstorm",
        96: "⛈️ Thunderstorm with hail",
        99: "⛈️ Thunderstorm with heavy hail"
    }
    return codes.get(code, f"Weather code {code}")


@mcp.tool()
def get_weather(city: str = "Jakarta") -> str:
    """
    Get current weather and 3-day forecast for a city.
    
    Args:
        city: City name (e.g., 'Jakarta', 'Tokyo', 'New York')
    
    Returns:
        Current weather conditions and forecast
    """
    lat, lon, resolved_city = get_coordinates(city)
    
    if lat is None:
        return f"Could not find location: {city}. Please try a different city name."
    
    weather = get_weather_data(lat, lon)
    
    if not weather:
        return f"Could not fetch weather data for {resolved_city}"
    
    current = weather.get('current', {})
    daily = weather.get('daily', {})
    
    temp = current.get('temperature_2m', 'N/A')
    humidity = current.get('relative_humidity_2m', 'N/A')
    wind = current.get('wind_speed_10m', 'N/A')
    weather_code = current.get('weather_code', 0)
    
    result = f"🌍 **Weather for {resolved_city}**\n\n"
    result += f"**Current Conditions:**\n"
    result += f"• {weather_code_to_description(weather_code)}\n"
    result += f"• Temperature: {temp}°C\n"
    result += f"• Humidity: {humidity}%\n"
    result += f"• Wind: {wind} km/h\n\n"
    
    result += f"**3-Day Forecast:**\n"
    dates = daily.get('time', [])[:3]
    max_temps = daily.get('temperature_2m_max', [])[:3]
    min_temps = daily.get('temperature_2m_min', [])[:3]
    codes = daily.get('weather_code', [])[:3]
    rain_probs = daily.get('precipitation_probability_max', [])[:3]
    
    for i, date in enumerate(dates):
        result += f"• **{date}**: {weather_code_to_description(codes[i] if i < len(codes) else 0)}\n"
        result += f"  High: {max_temps[i] if i < len(max_temps) else 'N/A'}°C, "
        result += f"Low: {min_temps[i] if i < len(min_temps) else 'N/A'}°C"
        if i < len(rain_probs):
            result += f", Rain: {rain_probs[i]}%"
        result += "\n"
    
    return result


@mcp.tool()
def get_temperature(city: str = "Jakarta") -> str:
    """
    Get just the current temperature for a city.
    
    Args:
        city: City name
    
    Returns:
        Current temperature
    """
    lat, lon, resolved_city = get_coordinates(city)
    
    if lat is None:
        return f"Could not find: {city}"
    
    weather = get_weather_data(lat, lon)
    
    if not weather:
        return f"Could not get temperature for {resolved_city}"
    
    temp = weather.get('current', {}).get('temperature_2m', 'N/A')
    return f"🌡️ Current temperature in {resolved_city}: {temp}°C"


if __name__ == "__main__":
    mcp.run(transport="stdio")
