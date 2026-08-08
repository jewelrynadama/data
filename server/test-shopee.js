const { create } = require('@wppconnect-team/wppconnect');
const fs = require('fs');

create({
    session: 'whatsapp-session',
    headless: true,
}).then((client) => {
    client.getMessages('622150996855@c.us', { count: 5 }).then(msgs => {
        fs.writeFileSync('shopee_msgs.json', JSON.stringify(msgs, null, 2));
        console.log('Saved to shopee_msgs.json');
        process.exit(0);
    });
}).catch(e => console.error(e));
