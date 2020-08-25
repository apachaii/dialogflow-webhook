
const express = require("express");
const bodyParser = require("body-parser");
const ngrok = require('ngrok');
const fetch = require("node-fetch");
const app = express();
let contador = 0
const port = process.env.PORT || 3000;
const ip = process.env.IP || "127.0.0.1";
let followerList = "";
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.post('/',  async(req, res) => {
  
    if (req.body.queryResult.action == "full-test") {
        let num1 = parseFloat(req.body.queryResult.parameters.num1);
        let num2 = parseFloat(req.body.queryResult.parameters.num2);
        let query = req.body.queryResult.queryText
         contador = 0
        let info = await repos(query)
        res.json({
            "followupEventInput": {
                "name": "TEST_ACTION",
                "languageCode": "en-US",
                "parameters": {
                    "info": info
                  }
              }
        });      
    }
     
     if (req.body.queryResult.action == "SI_Gracias") {
        let valor = parseFloat(req.body.queryResult.parameters.valor);
        console.log(valor);
        switch (valor) {
            case 1:
                res.json({
                    "fulfillmentText": "Muchas Gracias por tu respuesta"
                });
                break;
            case 2:
                res.json({
                    "followupEventInput": {
                        "name": "Quiere_Probar_otra_Respuesta",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": "info"
                          }
                      }
                });
                break;
            case 3:
                res.json({
                    "followupEventInput": {
                        "name": "Quiere_Probar_otra_Respuesta",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": "info"
                          }
                      }
                });
                break; 
            case 4:
                res.json({
                    "followupEventInput": {
                        "name": "Quiere_Probar_otra_Respuesta",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": "info"
                          }
                      }
                });
                break;  
            case 5:
                res.json({
                    "followupEventInput": {
                        "name": "Quiere_Probar_otra_Respuesta",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": "info"
                          }
                      }
                });
                break;    
            default:
                break;
        }   

     }

     if(req.body.queryResult.action == "Quiere_Probar_otra_Respuesta.Quiere_Probar_otra_Respuesta-yes"){
        //  res.json({
        //      "fulfillmentText": followerList.slice(1,2)
        //  });
        contador = contador +1
        switch (contador) {
            case 1:
                res.json({
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": followerList.slice(1,2)
                          }
                      }
                }); 
                
                break;
            case 2:
                res.json({
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": followerList.slice(2,3)
                          }
                      }
                }); 
            case 3:
                res.json({
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": followerList.slice(3,4)
                          }
                      }
                }); 
                break;  
            case 4:
                res.json({
                    "followupEventInput": {
                        "name": "TEST_ACTION",
                        "languageCode": "en-US",
                        "parameters": {
                            "info": followerList.slice(4,5)
                          }
                      }
                }); 
                break;
            case 5:
                res.json({
                    "fulfillmentText": "no tenemos mas respuestas, gracias"
                   });
                break;  
        
            default:
                break;
        }
       
        console.log("variable"+contador)
         
     }     

     if(req.body.queryResult.action == "Quiere_Probar_otra_Respuesta.Quiere_Probar_otra_Respuesta-no"){
        res.json({
            "fulfillmentText": "OK, será para la Próxima"
        });
    }     


    
});

const repos = async(User_Query) => {
    try {
        let response = await fetch(`https://zblessons-production.us-east-2.elasticbeanstalk.com//lesson_recommend?query=${User_Query}`);
        let json = await response.json();
        // var followerList = json.map(repo => repo.solution);
        followerList =  await json.map(repo => repo.solution);
        console.log(followerList.slice(1,));
        console.log(response);

        return followerList

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