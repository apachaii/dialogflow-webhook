const express = require("express");
const bodyParser = require("body-parser");
const ngrok = require('ngrok');
const fetch = require("node-fetch");
const app = express();
const {WebhookClient, Image, Payload, Card, Suggestion, Platforms} = require('dialogflow-fulfillment');
const { text } = require("body-parser");
const { query_psql } = require("./psql");
const { query_psql_lesson } = require("./psql_lesson");
require('dotenv').config();
let contador = 0
const port = process.env.PORT || 3000;
const ip = process.env.IP || "127.0.0.1";
let followerList = "";
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.post('/',  async(req, res) => {

    const agent = new WebhookClient({
        request: req,
        response: res
    });
    console.log(req.body);
    console.log(req.body.queryResult.fulfillmentMessages);
    console.log(req.body.queryResult.outputContexts);

    if (req.body.queryResult.action == "full-test") {
        
        try {
            let query = req.body.queryResult.queryText
            contador = 0
            let info = await repos(query)

            let output = req.body.queryResult.outputContexts;
            let session = output[0].name.split("agent/sessions/")[1].split("/")[0];
            output.push({
                "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
                "lifespanCount": 20,
                "parameters": {
                    "contadorIntento": 1,
                    "data": info,
                    "original_rec_query": query
                }
            }); 
            console.log("A responder", {
                "outputContexts": output,
                "followupEventInput": {
                    "name": "TEST_ACTION",
                    "languageCode": "en-US",
                    "parameters": {
                        "info": info[0].solution,
                        "lessonId": info[0].id
                    }
                }
            });
            res.json({
                "outputContexts": output,
                "followupEventInput": {
                    "name": "TEST_ACTION",
                    "languageCode": "en-US",
                    "parameters": {
                        "info": info[0].solution,
                        "lessonId": info[0].id
                    }
                }
            });   
        } catch (e) {
            console.log(e);
            res.json({"fulfillmentText": "Intente nuevamente"});
            return;
        }   
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
            projects = {}
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
    }

    if (req.body.queryResult.action == 'project_number') {
        try {
            let number = agent.contexts[0].parameters.number;
            let username = agent.contexts[0].parameters.username;
            console.log(username);
            let data = agent.contexts[0].parameters.projects[number.toString()];
            let info = await tasks_productivity(data[0]);
            let resp = "No hay tareas asignadas para usted."
            info["fullfilmentText"]["blocks"].forEach(block => {
                console.log(block);
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
    }
    
    if (req.body.queryResult.action == "number_eval") {
        let contexto = agent.getContext("numeros-eval");
        let user_id = 'cc7baf7c-839b-41ea-b791-a416a3b0ee92';
        let rec_context = agent.getContext("recommendation-data");
        try {
            let numberEval = contexto.parameters.numberEval;
            let lessonNumber = rec_context.parameters.lessonId;
            let attempt = rec_context.parameters.contadorIntento;
            let original_query = rec_context.parameters.original_rec_query;
            user_id = req.body.originalDetectIntentRequest.payload.userId;
            console.log(numberEval, lessonNumber, attempt, user_id, original_query);
            if ( numberEval != undefined && 
                lessonNumber != undefined && 
                attempt != undefined && 
                user_id != undefined ) {
                    if (process.env.SAVE_INTERACTION_LESSON == "true") {
                        let data = await query_psql_lesson(
                            `INSERT INTO public.user_lesson ("user_id", "lesson_id", "attemps", "points", "query") VALUES ($1, $2, $3, $4, $5)`,
                            [user_id, parseInt(lessonNumber), parseInt(attempt), parseInt(numberEval), original_query]
                        );
                        if (data != null) {
                            console.log("Guardado en la base de datos");
                        }
                    }
                }
            res.json({
                "fulfillmentText": `Gracias por evaluar con un ${numberEval}\n¿Desea otra respuesta?`,
                "fulfillmentMessages": [
                    {
                        "text": {
                            "text": [
                                `¡Gracias por evaluar con un ${numberEval}!`
                            ]
                        }
                    },
                    {
                        "text": {
                            "text": [
                                "¿Desea otra respuesta?"
                            ]
                        }
                    },
                    {
                        "payload": {
                            "richContent": [
                            [
                                {
                                    "type": "chips",
                                    "options": [
                                        {
                                            "text": "Sí"
                                        },
                                        {
                                            "text": "No"
                                        }
                                    ]
                                }
                            ]
                            ]
                        }
                    }
                ]
            });
            return;
        } catch (e) {
            console.log(e);
        }
        return
    }

    if (req.body.queryResult.action == "NO_Gracias") {
        let output = req.body.queryResult.outputContexts;
        let session = output[0].name.split("agent/sessions/")[1].split("/")[0];
        let data = {
            "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
            "lifespanCount": 0,
            "parameters": {}
        }; 
        const newOutput = output.filter(item => item.name !== data.name)
        newOutput.push(data);
        res.json({
            "outputContexts": newOutput,
            "fulfillmentText": "OK, será para la Próxima"
        });
        return
    }
     
    if (req.body.queryResult.action == "SI_Gracias") {
        let contexto = agent.getContext("recommendation-data");
        // console.log(contexto);
        let contador = contexto.parameters.contadorIntento + 1;
        contexto.parameters.contadorIntento += 1;
        let data = contexto.parameters.data;
        
        let output = req.body.queryResult.outputContexts;
        let session = output[0].name.split("agent/sessions/")[1].split("/")[0];
        // agent.context.set({
        //     "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
        //     "lifespanCount": 20,
        //     "parameters": {
        //         "contadorIntento": contador,
        //         "data": data,
        //     }
        // });
        output.push({
            "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
            "lifespanCount": 20,
            "parameters": {
                "contadorIntento": contador,
                "data": contexto.parameters.data,
            }
        }); 
        
        
        let data_to_rec = await query_psql_lesson(
            "SELECT * FROM public.lesson where id=$1",
            [data[contador - 1].id]
        );
        if (data_to_rec != null) {
            data_to_rec = data_to_rec[0]
        } else {

        }

        let response;
        switch (contador) {
            case 2:
                response = res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "lessonId": data[contador - 1].id, 
                            "info": data_to_rec.solution
                          }
                      }
                }); 
                
                break;
            case 3:
                response = res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "lessonId": data[contador - 1].id, 
                            "info": data_to_rec.solution
                          }
                      }
                }); 
                break;
            case 4:
                response = res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "lessonId": data[contador - 1].id, 
                            "info": data_to_rec.solution
                          }
                      }
                }); 
                break;  
            case 5:
                response = res.json({
                    "outputContexts": output,
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "lessonId": data[contador - 1].id, 
                            "info": data_to_rec.solution
                          }
                      }
                }); 
                break;
            case 6:
                response = res.json({
                    "fulfillmentText": "No tenemos más respuestas, muchas gracias."
                   });
                break;  
        }
        return response;

    }     

});

const repos = async(User_Query) => {
    try {
        let response = await fetch(`https://zblessons-production.us-east-2.elasticbeanstalk.com//lesson_recommend?query=${User_Query}`);
        let json = await response.json();
        let i = 0;
        let followerList =  await json.map((repo) => {
            if (i == 0) {
                i = 1;
                return {
                    "id": repo.id,
                    "solution": repo.solution
                }
            } else {
                return {
                    "id": repo.id,
                }
            }
        });
        return followerList.slice(0, 5)

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


app.listen(port, ip);

(async function () {
    const url = await ngrok.connect(port);
    console.log(url);
})();