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
const { query_psql_lesson } = require("./psql_lesson");
require('dotenv').config();
const fetch = require("node-fetch");

router.use(compression());
router.use(cors());
// router.use(bodyParser.json());
// router.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
router.use(awsServerlessExpressMiddleware.eventContext());

router.post('/dialogflow', async (req, res) => {

    const agent = new WebhookClient({
        request: req,
        response: res
    });
    console.log(req.body);

    if (req.body.queryResult.action == "full-test") {
        
        try {
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
                    "original_rec_query": query
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
            "select up.user_id, up.project_id, u.id, u.name as username, p.name from public.user_joins_projects as up, public.users as u, public.projects as p where u.id = $1 and u.id = up.user_id and up.project_id = p.id AND up.deleted_at IS NULL",
            [user_id]
        );

        let projects;
        if (data != null && data.length > 0) {
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
        let contador = contexto.parameters.contadorIntento + 1;
        contexto.parameters.contadorIntento += 1;
        let data = contexto.parameters.data;
        let original_query = contexto.parameters.original_rec_query;
        
        let output = req.body.queryResult.outputContexts;
        let session = output[0].name.split("agent/sessions/")[1].split("/")[0];

        output.push({
            "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
            "lifespanCount": 20,
            "parameters": {
                "contadorIntento": contador,
                "data": contexto.parameters.data,
                "original_rec_query": original_query
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
        if (contador < 6) {
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
        } else {
            response = res.json({
                "fulfillmentText": "No tenemos más respuestas, muchas gracias."
            });
        }
        return response;
    }     

});

const repos = async(User_Query) => {
    try {
        let response = await fetch(`${process.env.RECOMMEND_URL}?${process.env.QUERY_PARAM}=${User_Query}`);
        let json = await response.json();
        let i = 0;
        let followerList = await json.sort((a, b) => (2 * parseInt(a.votes) + parseInt(a.views)) < (2 * parseInt(b.votes) + parseInt(b.views)) ? 1 : - 1).map((repo) => {
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
        return followerList.slice(0, 10)

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
