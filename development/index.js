const express = require("express");
const bodyParser = require("body-parser");
const ngrok = require('ngrok');
const fetch = require("node-fetch");
const app = express();
const {WebhookClient, Image, Payload, Card, Suggestion, Platforms} = require('dialogflow-fulfillment');
const { text } = require("body-parser");
const { query_psql } = require("./psql");
const { query_psql_lesson } = require("./psql_lesson");
const { info } = require("actions-on-google/dist/common");
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
            let info = await repos(query)
            let user_id = req.body.originalDetectIntentRequest.payload.userId;
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
            output.push({
                "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/prueba_numero`,
                "lifespanCount": 1
            }); 

            let information = info[0].solution;
            let is_url = false;
            // console.log("Largo de la infromación", information.length)
            if (information.length > 300) {
                try {
                    let _proyects = await query_psql(
                        "select up.user_id, up.project_id, u.id, u.name as username, p.name from public.user_joins_projects as up, public.users as u, public.projects as p where u.id = $1 and u.id = up.user_id and up.project_id = p.id AND up.deleted_at IS NULL",
                        [user_id]
                    );

                    let proyecto;
                    if (_proyects != null && _proyects.length > 0) {
                        projects = {}
                        for (i = 0; i < _proyects.length; i++) {
                            pro = _proyects[i];
                            if (pro.name != "Example") {
                                proyecto = pro.project_id;
                                break;
                            }
                        };
                        let original_query = query;
                        let host = "localhost:8000"; // "https://zmartboard.cl"
                        // information = "El contenido de la lección se encuentran en el siguiente link:\n"
                        information = `${host}/project/${proyecto}/lessons/${info[0].id}?q=${original_query}`
                        is_url = true;
                    }
                } catch (e){
                    console.log(e)
                }
            }
            let answers = [{
                "text": {
                    "text": [
                        `Lección proporcionada por: ${info[0].owner}`
                    ]
                }
            },
            {
                "text": {
                    "text": [
                        info[0].name
                    ]
                }
            }];

            if (is_url) {
                answers.push({
                    "payload": {
                        "richContent":[

                            [{
                                "options": [
                                    {
                                        "text": "Ver lección",
                                        "link": information
                                    }
                                ],
                                "type": "chips"
                            }]
                        ]
                    }
                })
            } else {
                answers.push({
                    "text": {
                        "text": [
                            information
                        ]
                    }
                })
            }

            answers = answers.concat([
            {
                "text": {
                    "text": [
                        "¿Le pareció útil esta información?"
                    ]
                }
            },
            {
                "payload": {
                    "richContent":[
                        [{
                            "options": [
                                {
                                    "text": "1"
                                },
                                {
                                    "text": "2"
                                },
                                {
                                    "text": "3"
                                },
                                {
                                    "text": "4"
                                },
                                {
                                    "text": "5"
                                }
                            ],
                            "type": "chips"
                        }]
                    ]
                }
            }]);
            //console.log(JSON.stringify(answers));
            res.json({
                "outputContexts": output,
                "fulfillmentMessages": answers
            });

            // res.json({
            //     "outputContexts": output,
            //     "followupEventInput": {
            //         "name": "TEST_ACTION",
            //         "languageCode": "en-US",
            //         "parameters": {
            //             "owner": info[0].owner,
            //             "name": info[0].name, 
            //             "info": information,
            //             "lessonId": info[0].id
            //         }
            //     }
            // });   
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
        
        let proyects;
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
                        try {
                            let data = await fetch(`https://lessons.zmartboard.cl/lesson_user_rating`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Access-Control-Allow-Origin": "*"
                                },
                                body: JSON.stringify({
                                    userId: user_id,
                                    lessonId: lessonNumber,
                                    attemps: attempt,
                                    points: numberEval,
                                    querytext: original_query
                                })
                            });
                            // let data = await query_psql_lesson(
                            //     `INSERT INTO public.user_lesson ("user_id", "lesson_id", "attemps", "points", "query") VALUES ($1, $2, $3, $4, $5)`,
                            //     [user_id, parseInt(lessonNumber), parseInt(attempt), parseInt(numberEval), original_query]
                            // );
                            if (data != null) {
                                console.log("Guardado en la base de datos");
                            }
                        } catch (e) {
                            console.log(e);
                            console.log("Hubo un error al guardar la interacción");
                        }
                    }
                }
            let texto = (parseInt(numberEval) < 3) ? "Que lástima, seguiré buscando": `¡Gracias por evaluar con un ${numberEval}!`;
            res.json({
                "fulfillmentText": `Gracias por evaluar con un ${numberEval}\n¿Desea otra respuesta?`,
                "fulfillmentMessages": [
                    {
                        "text": {
                            "text": [
                                texto
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
        try {
            user_id = req.body.originalDetectIntentRequest.payload.userId;
        } catch (e) {
            res.json({
                "fulfillmentText": "No hay usuario"
            });
            return;
        }
        
        // let contexto = agent.getContext("recommendation-data");

        // let output = req.body.queryResult.outputContexts;
        // let session = output[0].name.split("agent/sessions/")[1].split("/")[0];
        // let data = {
        //     "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/recommendation-data`,
        //     "lifespanCount": 0,
        //     "parameters": {}
        // }; 
        // const newOutput = output.filter(item => item.name !== data.name)
        // newOutput.push(data);

        // try {
        //     let _proyects = await query_psql(
        //         "select up.user_id, up.project_id, u.id, u.name as username, p.name from public.user_joins_projects as up, public.users as u, public.projects as p where u.id = $1 and u.id = up.user_id and up.project_id = p.id AND up.deleted_at IS NULL",
        //         [user_id]
        //     );

        //     let proyecto;
        //     if (_proyects != null && _proyects.length > 0) {
        //         projects = {}
        //         for (i = 0; i < _proyects.length; i++) {
        //             pro = _proyects[i];
        //             if (pro.name != "Example") {
        //                 proyecto = pro.project_id;
        //                 break;
        //             }
        //         };
        //         let original_query = contexto.parameters.original_rec_query;
        //         let host = "localhost:8000"; // "https://zmartboard.cl"
        //         return res.json({
        //             "outputContexts": newOutput,
        //             "fulfillmentMessages": [
        //                 {
        //                     "text": {
        //                         "text": [
        //                             "Las recomendaciones se encuentran en el siguiente link."
        //                         ]
        //                     }
        //                 },
        //                 {
        //                     "text": {
        //                         "text": [
        //                             `${host}/project/${proyecto}/lessons?query=${original_query}`
        //                         ]
        //                     }
        //                 },
        //                 {
        //                     "payload": {
        //                         "richContent": [
        //                         [
        //                             {
        //                                 "type": "chips",
        //                                 "options": [
        //                                     {
        //                                         "text": "Siguientes recomendaciones",
        //                                         "link": `${host}/project/${proyecto}/lessons?query=${original_query}`
        //                                     }
        //                                 ]
        //                             }
        //                         ]
        //                         ]
        //                     }
        //                 }
        //             ]
        //         });
        //     }
        // } catch {
        //     return res.json({
        //         "outputContexts": newOutput,
        //         "fulfillmentText": "Lamentablemente no tienes proyectos y no te puedo redirigir a más lecciones :("
        //     });
        // }
        

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
        output.push({
            "name": `projects/quickstart-1565748608769/agent/sessions/${session}/contexts/prueba_numero`,
            "lifespanCount": 1
        });
        
        
        let data_to_rec = await query_psql_lesson(
            "SELECT * FROM public.lesson where id=$1",
            [data[contador - 1].id]
        );
        if (data_to_rec != null) {
            data_to_rec = data_to_rec[0]
        } else {

        }

        let information = data_to_rec.solution;
        let is_url = false;
        console.log("Largo de la infromación", information.length)
        if (information.length > 300) {
            try {
                let _proyects = await query_psql(
                    "select up.user_id, up.project_id, u.id, u.name as username, p.name from public.user_joins_projects as up, public.users as u, public.projects as p where u.id = $1 and u.id = up.user_id and up.project_id = p.id AND up.deleted_at IS NULL",
                    [user_id]
                );

                let proyecto;
                if (_proyects != null && _proyects.length > 0) {
                    projects = {}
                    for (i = 0; i < _proyects.length; i++) {
                        pro = _proyects[i];
                        if (pro.name != "Example") {
                            proyecto = pro.project_id;
                            break;
                        }
                    };
                    let original_query = contexto.parameters.original_rec_query;
                    let host = "localhost:8000"; // "https://zmartboard.cl"
                    // information = "El contenido de la lección se encuentran en el siguiente link:\n"
                    information = `${host}/project/${proyecto}/lessons/${data_to_rec.id}?q=${original_query}`
                    is_url = true;
                }
            } catch (e){
                console.log(e)
            }
        }

        let response;
        if (contador < 6) {
            let _own = (data_to_rec.user_publisher_email == "None") ? "Anónimo" : data_to_rec.user_publisher_email;
            let answers = [{
                "text": {
                    "text": [
                        `Lección proporcionada por: ${_own}`
                    ]
                }
            },
            {
                "text": {
                    "text": [
                        data_to_rec.name
                    ]
                }
            }];

            if (is_url) {
                answers.push({
                    "payload": {
                        "richContent":[

                            [{
                                "options": [
                                    {
                                        "text": "Ver lección",
                                        "link": information
                                    }
                                ],
                                "type": "chips"
                            }]
                        ]
                    }
                })
            } else {
                answers.push({
                    "text": {
                        "text": [
                            information
                        ]
                    }
                })
            }

            answers = answers.concat([
            {
                "text": {
                    "text": [
                        "¿Le pareció útil esta información?"
                    ]
                }
            },
            {
                "payload": {
                    "richContent":[
                        [{
                            "options": [
                                {
                                    "text": "1"
                                },
                                {
                                    "text": "2"
                                },
                                {
                                    "text": "3"
                                },
                                {
                                    "text": "4"
                                },
                                {
                                    "text": "5"
                                }
                            ],
                            "type": "chips"
                        }]
                    ]
                }
            }]);
            res.json({
                "outputContexts": output,
                "fulfillmentMessages": answers
            });
            // response = res.json({
            //     "outputContexts": output,
            //     "followupEventInput": {
            //         "name": "TEST_ACTION",
            //         "languageCode": "en-US",
            //         "parameters": {
            //             "name": data_to_rec.name,
            //             "owner": data_to_rec.user_publisher_email || "Anónimo", 
            //             "info": information,
            //             "lessonId": data[contador - 1].id, 
            //         }
            //     }
            // });
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
        // let url = "https://zblessons-production.us-east-2.elasticbeanstalk.com//lesson_recommend"
        let url = "https://lessons.zmartboard.cl/recommend"
        let response = await fetch(`${url}?${process.env.QUERY_PARAM}=${User_Query}`);
        let json = await response.json();
        let i = 0;
        // let followerList =  await json.map((repo) => {
        let data = json;
        if (json.hasOwnProperty("lessons")) {
            data = json.lessons;
        }
        let followerList = await data.sort((a, b) => (2 * parseInt(a.votes) + parseInt(a.views)) < (2 * parseInt(b.votes) + parseInt(b.views)) ? 1 : -1).map((repo) => {    
            if (i == 0) {
                i = 1;
                return {
                    "id": repo.id,
                    "solution": repo.solution,
                    "owner": (repo.user_publisher_email == "None") ? "Anónimo": repo.user_publisher_email,
                    "name": repo.name
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


app.listen(port, ip);

(async function () {
    const url = await ngrok.connect(port);
    console.log(url);
})();