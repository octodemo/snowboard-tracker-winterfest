import { Octokit } from "octokit";
import { getWeatherFor } from './getWeather.js';
import { WeatherFields } from './projectFields.js';

const { GITHUB_TOKEN, PROJECT_ID } = process.env;
if(!GITHUB_TOKEN) {
  throw new Error('Please provide a GitHub Token to read from the Project.');
}
if(!PROJECT_ID) {
  throw new Error('Please provide a ProjectId to read from the Project.');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const getAllFieldItemsAndFieldIdsQuery =  `
query fieldItemsAndFieldIds($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                id
                text
                field {
                  ... on ProjectV2FieldCommon {
                    name
                  }
                }
              }
            }
          }
        }
      }
      fields(first: 100) {
        nodes {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
      }
    }
  }
}
`

const updateWeatherAndTemperastureQuery = `
mutation updateWeather(
  $projectId: ID!, 
  $itemId:ID!, 
  $weatherFieldId:ID!, 
  $weatherValue: String!
  $temperatureFieldId:ID!,
  $temperatureValue: Float!
  ) {
  updateWeather: updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $weatherFieldId
      value: { 
        text: $weatherValue
      }
    }
  ) {
    projectV2Item {
      id
    }
  }
  updateTemperature: updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $temperatureFieldId
      value: { 
        number: $temperatureValue
      }
    }
  ) {
    projectV2Item {
      id
    }
  }
}
`

octokit.graphql(getAllFieldItemsAndFieldIdsQuery, { projectId: PROJECT_ID }).then(async (result) => {
  const items = result.node.items.nodes;
  const fields = result.node.fields.nodes;

  const weatherField = fields.find(field => field.name.includes('Weather'));
  const tempField = fields.find(field => field.name.includes('Temperature'));
  
  for (const item of items) {
    const name = item.fieldValues.nodes.find((fieldValue) => fieldValue.field?.name.endsWith('Title'))?.text;
    const latField = item.fieldValues.nodes.find((fieldValue) => fieldValue.field?.name.endsWith('Lat'));
    const lonField = item.fieldValues.nodes.find((fieldValue) => fieldValue.field?.name.endsWith('Lon'));
    
    if(!latField || !lonField) {
      console.log(`Skipping ${name} because it has no lat/lon values.`);
      continue;
    }
    
    const currentWeather = await getWeatherFor(latField.text, lonField.text);
    
    const tempValue = currentWeather.main.temp;
    const apiWeatherValue  =  currentWeather.weather[0].main;
    const projectFieldWeatherValue = WeatherFields[apiWeatherValue] ?? WeatherFields.Unknown;
    
    console.log(`Setting Weather for ${name} to ${projectFieldWeatherValue} and Temperature to ${tempValue}.`);
    await octokit.graphql(updateWeatherAndTemperastureQuery, {
      projectId: PROJECT_ID,
      itemId: item.id,
      weatherFieldId: weatherField.id,
      weatherValue: projectFieldWeatherValue,
      temperatureFieldId: tempField.id,
      temperatureValue: tempValue
    });
  }
});
