import express from 'express'
import bodyParser from 'body-parser'
import request from 'request'

import { Wit, log } from 'node-wit'


const app = express()
const client = new Wit({accessToken: process.env.WIT_SERVER_KEY})
const token = process.env.FACEBOOK_PAGE_TOKEN

app.use(bodyParser.urlencoded({extended: false}))

app.use(bodyParser.json())



function getCapiData(keyword = '') {
    return new Promise((resolve, reject) => {
        request({
            url: `http://api.newsapi.com.au/uat/content/v2/?api_key=6tjkx2ydv52e2j2k4wtxathk&query=contentType:NEWS_STORY%20AND%20keywords:${keyword}`,
            method: 'GET'
        }, function(error, response, body) {
            if (error) {
                reject(error)
            } else if (response.body) {
                resolve(JSON.parse(response.body))
            }
        })
    })
}

async function getWitData(message) {
    try {
        const intent = await client.message(message, {})
        
        console.log(intent.entities)
        return intent.entities
    } catch (error) {
        
    }
    
}

async function processMessage(receiver, message) {
    // try {
        // understand message
        const intent = await getWitData(message)
        const query = (intent.search_query || []).filter(search => {
            return search.confidence > 0.9
        })

        if (query.length > 0) {
            
            const data = await getCapiData(query[0].value)
            // build message
            let results = []
            if(data.results.length > 0) {
                results = data.results.map(post => {
                    return {
                        title: post.title,
                        link: post.link,
                        subtitle: post.subtitle,
                        image: post.thumbnailImage ? post.thumbnailImage.link: ''
                    }
                })
            }
            const facebookMessge = buildMessage(results)
            // send text    
            sendTextMessage(receiver, facebookMessge)
        }
        
        
    // } catch (error) {
        
    // }
    
}


function buildMessage(datas) {
    datas = datas.slice(0,4)
    return {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "list",
                "top_element_style": "compact",
                "elements": datas.map(article => ({
                    "title": article.title,
                    "subtitle": article.subtitle,
                    image_url: article.image,
                    "buttons": [{
                        "title": "View",
                        "type": "web_url",
                        "url": article.link,
                        "messenger_extensions": "false",
                        "webview_height_ratio": "full"
                    }],
                    "default_action": {
                        "type": "web_url",
                        "url": article.link,
                        "messenger_extensions": "false",
                        "webview_height_ratio": "full"
                    }
                }))
            }
        }
        
    }
}

function sendTextMessage(sender, message) {
    request({
	    url: 'https://graph.facebook.com/v2.6/me/messages',
	    qs: {access_token:token},
	    method: 'POST',
		json: {
		    recipient: {id:sender},
			"message": message
		}
	}, function(error, response, body) {
		if (error) {
		    console.log('Error sending messages: ', error)
		} else if (response.body.error) {
		    console.log('Error: ', response.body.error)
	    }
    })
}

app.get('/webhook', function (req, res) {
	if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
		res.send(req.query['hub.challenge'])
	}
	res.send('Error, wrong token')
})

app.post('/webhook', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
	    let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        console.log(event.sender)
	    if (event.message && event.message.text) {
            let text = event.message.text
            processMessage(sender, text)
	    }
    }
    res.sendStatus(200)
})

app.get('/', (req, res) => {
    console.log(req.query)
    res.send(200, req.query['hub.challenge'])
})

app.listen(process.env.PORT || 4000, () => {
    console.log('Bot server is working')
})