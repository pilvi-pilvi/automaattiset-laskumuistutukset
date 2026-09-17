const CONFIG = {
  searchQuery: 'newer_than:1d -in:spam lasku',
  processedIdsProperty: 'PROCESSED_MESSAGE_IDS',
  maxProcessedIds: 1000,
};

/**
 * Run this once to create the recurring Gmail scan.
 */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'processLaskuAttachments')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('processLaskuAttachments')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();

  Logger.log('Gmail invoice reminder trigger is ready.');
}

/**
 * Finds matching Gmail messages and creates Calendar reminders from their bodies.
 */
function processLaskuAttachments() {
  const properties = PropertiesService.getScriptProperties();
  const processedIds = getProcessedIds_(properties);
  const messages = GmailApp.search(CONFIG.searchQuery)
    .flatMap((thread) => thread.getMessages());
  const newlyProcessedIds = new Set(processedIds);

  messages.forEach((message) => {
    const messageId = message.getId();
    if (newlyProcessedIds.has(messageId)) {
      return;
    }

    const invoice = extractInvoiceDetails_(
      message.getPlainBody(),
      getSenderName_(message.getFrom()),
    );
    let invoiceDetails = invoice;
    if (!invoiceDetails) {
      message.getAttachments().some((attachment) => {
        invoiceDetails = extractInvoiceDetails_(
          extractAttachmentText_(attachment),
          getSenderName_(message.getFrom()),
        );
        return Boolean(invoiceDetails);
      });
    }

    if (invoiceDetails) {
      createCalendarReminder_(invoiceDetails, message);
    } else {
      Logger.log(`Could not extract invoice details from ${message.getSubject()}.`);
    }
    newlyProcessedIds.add(messageId);
  });

  const idsToStore = Array.from(newlyProcessedIds).slice(-CONFIG.maxProcessedIds);
  properties.setProperty(CONFIG.processedIdsProperty, JSON.stringify(idsToStore));
  Logger.log(`Processed ${idsToStore.length - processedIds.length} new message(s).`);
}

function extractInvoiceDetails_(text, senderName) {
  const dueDateMatch = text.match(
    /(?:eräpäivä|due\s*date)\s*[:.]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
  );
  const dueImmediately = /(?:erääntynyt|erääntyy\s+heti|maksettava\s+heti|myöhässä|overdue|past\s+due|due\s+(?:immediately|now))/i.test(text);
  const companyMatch = text.match(
    /(?:yritys|toimittaja|myyjä|seller|company)\s*[:.]\s*([^\n]+)/i,
  );
  const amountMatch = text.match(
    /(?:maksettava(?:\s+summa)?|loppusumma|yhteensä|summa|total|amount)\s*[:.]?\s*([\d .]+(?:[,.]\d{2})?)\s*(?:€|eur)?/i,
  );

  if ((!dueDateMatch && !dueImmediately) || !amountMatch || (!senderName && !companyMatch)) {
    return null;
  }

  return {
    dueDate: dueImmediately ? new Date() : parseFinnishDate_(dueDateMatch[1]),
    company: companyMatch ? companyMatch[1].trim() : senderName,
    amount: amountMatch[1].trim(),
  };
}

function getSenderName_(sender) {
  const displayNameMatch = sender.match(/^\s*(.*?)\s*<[^>]+>\s*$/);
  return displayNameMatch ? displayNameMatch[1].trim() : sender.trim();
}

function extractAttachmentText_(attachment) {
  const blob = attachment.copyBlob();
  if (blob.getContentType().startsWith('text/')) {
    return blob.getDataAsString();
  }

  const ocrDocument = Drive.Files.insert(
    { title: `Temporary OCR - ${attachment.getName()}`, mimeType: MimeType.GOOGLE_DOCS },
    blob,
    { ocr: true, ocrLanguage: 'fi' },
  );
  try {
    return DocumentApp.openById(ocrDocument.id).getBody().getText();
  } finally {
    DriveApp.getFileById(ocrDocument.id).setTrashed(true);
  }
}

function parseFinnishDate_(value) {
  const parts = value.split(/[./-]/).map(Number);
  const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
  return new Date(year, parts[1] - 1, parts[0]);
}

function createCalendarReminder_(invoice, message) {
  const calendar = CalendarApp.getDefaultCalendar();
  calendar.createAllDayEvent(
    `Lasku: ${invoice.company} - ${invoice.amount} EUR`,
    invoice.dueDate,
    {
      description: [
        `Yritys: ${invoice.company}`,
        `Maksettava: ${invoice.amount} EUR`,
      ].join('\n'),
    },
  );
}

function getProcessedIds_(properties) {
  const value = properties.getProperty(CONFIG.processedIdsProperty);
  return value ? JSON.parse(value) : [];
}

