# Gmail lasku attachment automation

This Google Apps Script scans Gmail once a day around 07:00 Helsinki time for messages matching:

```text
newer_than:1d -in:spam lasku
```

The script first reads matching email bodies for the due date, company, and amount. If the company is missing, the sender's name is used instead. If the message says that the invoice is overdue or due immediately, the reminder is created for the current day. If the body is missing the required information, the script checks the email attachments using temporary Finnish OCR documents. Those temporary documents are deleted immediately; attachments are not saved to the `Laskut` folder or another permanent Drive location. When the required details are found, it creates an all-day reminder in the primary Google Calendar. Each message is processed once, so repeated scans do not create duplicate reminders.

## Setup

1. Open [script.google.com](https://script.google.com/) and create a new standalone project.
2. Copy `Code.gs` into the project and enable **Show appsscript.json manifest file** in Project Settings, then copy the manifest contents from `appsscript.json`.
3. Run `setup` once from the Apps Script editor.
4. Approve the requested Gmail, Calendar, and trigger permissions.

## Enable attachment OCR

PDF and image attachments use the Apps Script Advanced Drive service for Finnish OCR. In the Apps Script editor, open **Services**, add **Drive API**, and enable the Google Drive API in the linked Google Cloud project if Apps Script prompts you.

The parser recognizes due-date labels such as `eräpäivä` and `due date`. Dates may use `.`, `/`, or `-` separators, and one- or two-digit days and months, for example `19.9.2026` or `19.09.2026`. Amount labels include `maksettava`, `maksettava summa`, `loppusumma`, `yhteensä`, `summa`, `total`, and `amount`. Whole-number and decimal amounts are accepted, with either a comma or period as the decimal separator. Company labels include `yritys`, `toimittaja`, `myyjä`, `seller`, and `company`.

Overdue or immediately due wording includes `erääntynyt`, `erääntyy heti`, `maksettava heti`, `myöhässä`, `overdue`, `past due`, `due immediately`, and `due now`. If an email does not contain a recognizable amount and either a due date or immediate-due wording, no calendar event is created.

The trigger runs once a day around 07:00 Helsinki time. Apps Script time-driven triggers may run sometime within the configured hour.

## Adjusting the match

Change `CONFIG.searchQuery` in `Code.gs` to use a narrower Gmail search, for example:

```javascript
	searchQuery: 'from:billing@example.com newer_than:1d -in:spam lasku',
```

The search term `lasku` is case-insensitive in Gmail.
