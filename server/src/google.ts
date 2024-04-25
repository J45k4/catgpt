import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/dialogflow'],
    keyFilename: "google_service_account.json",
});

auth.getCredentials().then((creds) => {
	console.log(creds)
})

auth.getRequestHeaders().then((headers) => {
	console.log(headers)
})

export class Gemini {
	public createConversation() {

	}

	public generate() {
		
	}
}