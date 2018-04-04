"use strict"

process.env.DEBUG = 'actions-on-google:*'

const Assistant = require('actions-on-google').ApiAiAssistant
const functions = require('firebase-functions')
const admin = require('firebase-admin')
admin.initializeApp(functions.config().firebase)

// Root database name
const know = admin.database().ref('/chime-in');
const graph = know.child('quiz');

// Dialogflow Intent names
const TEST_INTENT = 'test'
const YES_INTENT = 'q-yes'
const NO_INTENT = 'q-no'

// Contexts
const TEST_CONTEXT = 'test'
const QUESTION_CONTEXT = 'question'
const GUESS_CONTEXT = 'guess'

// Context Parameters
const ID_PARAM = 'id'
const TEXT_ARGUMENT = 'myResponse'

exports.chimeIn = functions.https.onRequest((request, response) => {

    const assistant = new Assistant({ request: request, response: response })

    let actionMap = new Map()
    actionMap.set(TEST_INTENT, test)
    actionMap.set('input.unknown', discriminate);
    assistant.handleRequest(actionMap)

    function test(assistant) {
        const first_ref = know.child('first')
        first_ref.once('value', snap => {
            const first = snap.val()
            graph.child(first).once('value', snap => {
                const speech = `${snap.val().q}`

                const parameters = {}
                parameters[ID_PARAM] = snap.key
                actionMap.set('input.unknown', discriminate);
                assistant.handleRequest(actionMap)
                assistant.setContext(TEST_CONTEXT, 5, parameters)
                assistant.ask(speech)
            })
        })
    }

    function discriminate(assistant) {
        const priorQuestion = assistant.getContextArgument(TEST_CONTEXT, ID_PARAM).value;

        const intent = assistant.getIntent();
        const text = assistant.getArgument(TEXT_ARGUMENT)
        console.log(assistant)
        console.log(text)
        assistant.tell('You said ' + assistant.getRawInput())

        let yes_no;
        if (YES_INTENT === intent) {
            yes_no = 'a';
        } else {
            yes_no = 'n';
        }

        console.log(`prior question: ${priorQuestion}`);

        graph.child(priorQuestion).once('value', snap => {
            const next = snap.val()[yes_no];
            graph.child(next).once('value', snap => {
                const node = snap.val();
                if (node.q) {
                    const speech = node.q;

                    const parameters = {};
                    parameters[ID_PARAM] = snap.key;
                    assistant.setContext(QUESTION_CONTEXT, 5, parameters);
                    assistant.ask(speech);
                } else {
                    const guess = node.a;
                    const speech = `Is it a ${guess}?`;

                    const parameters = {};
                    parameters[ID_PARAM] = snap.key;
                    parameters[BRANCH_PARAM] = yes_no;
                    assistant.setContext(GUESS_CONTEXT, 5, parameters);
                    assistant.ask(speech);
                }
            });
        });
    }

});
