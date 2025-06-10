const axios = require('axios')

exports.sendTemplateMsg = async (num) => {
    const response = await axios({
        url: 'https://graph.facebook.com/v22.0/679592991902770/messages',
        method: 'post',
        headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
        },
        data: JSON.stringify({
            messaging_product: 'whatsapp',
            to: `91${num}`,
            type: 'template',
            template: {
                name: 'hello_world',
                language: {
                    code: 'en_US'
                }
            }
        })
    })

    console.log(response.data);
}

exports.sendBloodRequirementNotification = async (name, phone, num, blood) => {
    const response = await axios({
        url: 'https://graph.facebook.com/v22.0/679592991902770/messages',
        method: 'post',
        headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
        },
        data: JSON.stringify({
            messaging_product: 'whatsapp',
            to: `91${num}`,
            type: 'text',
            text: {
                body: `Urgent requirement of *${blood} blood*. Please contact if available: \n\n *Name: ${name}*\n *Phone No: ${phone}* . `
            }
        })
    })

    console.log(response.data);
}

exports.sendBloodDonationCompleteMessage = async (phone, message) => {
    try {
        const response = await axios({
            url: 'https://graph.facebook.com/v22.0/679592991902770/messages',
            method: 'post',
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: JSON.stringify({
                messaging_product: 'whatsapp',
                to: `91${phone}`,
                type: 'text',
                text: {
                    body: message
                }
            })
        })

        if (response.status === 401) {
            throw new Error('Request failed with status code 401');
        }

        console.log(response.data);
    } catch (error) {
        console.log(error.message);
    }
}
