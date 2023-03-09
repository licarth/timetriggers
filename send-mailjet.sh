# This call sends a message to one recipient.
curl -s \
	-X POST \
	--user "91e8cb55729ecc482231846608fb1dab:db96de05a97cc86db1de8872d2707df5" \
     'http://localhost:3002/schedule' \
      -H "ttr-scheduled-at: 2023-02-20T13:19:00.000+01:00" \
      -H "ttr-api-key: vMUIFJN0Wjrscxxqui4Qru3pf4QyODW5" \
      -H "ttr-url: https://api.mailjet.com/v3.1/send" \
	-H 'Content-Type: application/json' \
	-d '{
		"Messages":[
				{
						"From": {
								"Email": "thomascarli@gmail.com",
								"Name": "Thomas Carli"
						},
						"To": [
								{
										"Email": "thomascarli@gmail.com",
										"Name": "passenger 1"
								}
						],
						"Subject": "Your email flight plan!",
						"TextPart": "Dear passenger 1, welcome to Mailjet! May the delivery force be with you!",
						"HTMLPart": "<h3>Dear passenger 1, welcome to <a href=\"https://www.mailjet.com/\">Mailjet</a>!</h3><br />May the delivery force be with you!"
				}
		]
	}'