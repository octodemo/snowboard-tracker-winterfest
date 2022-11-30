import fetch from 'node-fetch';

const weatherKey = process.env.WEATHER_API_KEY;
if(!weatherKey) {
  throw new Error('Missing WEATHER_API_KEY environment variable');
}

async function getWeatherFor(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${weatherKey}`;
  const response = await fetch(url);
  const weather = JSON.parse(await response.text());
  return weather;
}

export {
  getWeatherFor
};
