'use strict';

const {WebhookClient, Suggestion} = require('dialogflow-fulfillment');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');

var express = require('express');
const app = express();
const router = express.Router();

const { query_psql } = require("./psql");
const fetch = require("node-fetch");

router.use(compression());
router.use(cors());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(awsServerlessExpressMiddleware.eventContext());

router.post('/dialogflow', async (req, res) => {

    const agent = new WebhookClient({
        request: req,
        response: res
    });
    console.log(req.body);
    console.log(req.body.queryResult.fulfillmentMessages);
    console.log(req.body.queryResult.outputContexts);

    if (req.body.queryResult.action == "full-test") {

        let query = req.body.queryResult.queryText
        let info = await repos(query)

        let output = req.body.queryResult.outputContexts;
        let session = output[0].name.split("agent/sessions/")[1].split("/")[0];
        output.push({
            "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
            "lifespanCount": 20,
            "parameters": {
                "contadorIntento": 1,
                "data": info,
            }
        }); 

        res.json({
            "outputContexts": output,
            "followupEventInput": {
                "name": "TEST_ACTION",
                "languageCode": "en-US",
                "parameters": {
                    "info": info[0].solution
                  }
              }
        });      
        return;
    }

    if (req.body.queryResult.intent.displayName == 'Tasks_Productivity') {

        let texto = "";
        let place = 1;

        let user_id = 'cc7baf7c-839b-41ea-b791-a416a3b0ee92';
        try {
            user_id = req.body.originalDetectIntentRequest.payload.userId;
        } catch (e) {
            res.json({
                "fulfillmentText": "No hay usuario"
            });
            return;
        }

        let data = await query_psql(
            "select up.user_id, up.project_id, u.id, u.name as username, p.name from public.user_joins_projects as up, public.users as u, public.projects as p where u.id = $1 and u.id = up.user_id and up.project_id = p.id",
            [user_id]
        );

        if (data != null) {
            let projects = {}
            data.forEach(pro => {
                projects[place] = [pro.project_id, pro.name];
                texto += `${place}) ${pro.name}\n`;
                place += 1;
            });
            res.json({
                "followupEventInput": {
                    "name": "SELECT_PROJECT",
                    "languageCode": "es-ES",
                    "parameters": {
                        "username": data[0].username,
                        "projects": projects,
                        "info": texto
                    }
                }
            });
        } else {
            res.json({
                "fulfillmentText": "No hay proyectos"
            });
        }
        return;
    }

    if (req.body.queryResult.action == 'project_number') {
        try {
            let number = agent.contexts[0].parameters.number;
            let username = agent.contexts[0].parameters.username;
            let data = agent.contexts[0].parameters.projects[number.toString()];
            let info = await tasks_productivity(data[0]);
            let resp = "No hay tareas asignadas para usted."
            info["fullfilmentText"]["blocks"].forEach(block => {
                if (block["text"]["text"].includes(username)) {
                    resp = block["text"]["text"];
                    return;
                }
            });
            res.json({
                "fulfillmentText": resp
            });
        } catch (e) {
            console.log(e);
            res.json({
                "fulfillmentText": "No existe ese proyecto"
            });
        }
        return;
    }

    if (req.body.queryResult.action == "NO_Gracias") {
        res.json({
            "fulfillmentText": "OK, será para la Próxima"
        });
        return;
    }

    if(req.body.queryResult.action == "Quiere_Probar_otra_Respuesta.Quiere_Probar_otra_Respuesta-no"){
        res.json({
            "fulfillmentText": "OK, será para la Próxima"
        });
        return;
    }     
     
    if (req.body.queryResult.action == "SI_Gracias") {
        let contexto = agent.getContext("recommendation-data");
        let contador = contexto.parameters.contadorIntento + 1;
        contexto.parameters.contadorIntento += 1;
        let data = contexto.parameters.data;
        
        let output = req.body.queryResult.outputContexts;
        let session = output[0].name.split("agent/sessions/")[1].split("/")[0];
        output.push({
            "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
            "lifespanCount": 20,
            "parameters": {
                "contadorIntento": contador,
                "data": contexto.parameters.data,
            }
        }); 

        switch (contador) {
            case 2:
                res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": data[contador - 1].solution
                          }
                      }
                }); 
                
                break;
            case 3:
                res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": data[contador - 1].solution
                          }
                      }
                }); 
            case 4:
                res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": data[contador - 1].solution
                          }
                      }
                }); 
                break;  
            case 5:
                res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": data[contador - 1].solution
                          }
                      }
                }); 
                break;
            case 6:
                res.json({
                    "fulfillmentText": "No tenemos más respuestas, muchas gracias."
                   });
                break;  
        
            default:
                break;
        }
        return;
    }     

});

const repos = async(User_Query) => {
    try {
        let response = await fetch(`https://zblessons-production.us-east-2.elasticbeanstalk.com//lesson_recommend?query=${User_Query}`);
        let json = await response.json();
        let followerList =  await json.map((repo) => {
            return {
            "id": repo.id,
            "solution": repo.solution
            }
        });
        return followerList

    } catch (error) {
        console.log(`Error: ${error}`);
        return error
    }
};

const tasks_productivity = async(project_id) => {
    try {
        let response = await fetch(`https://1qwsndrl70.execute-api.sa-east-1.amazonaws.com/prod/command/chat_task_productivity/${project_id}`);
        let json = await response.json();
        return json

    } catch (error) {
        console.log(`Error: ${error}`);
        return error
    }
};


app.use('/', router);

module.exports = app;
