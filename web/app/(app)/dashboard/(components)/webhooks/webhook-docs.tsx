'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code } from '@/components/ui/code'
import { AlertCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

const message_received_payload = {
  smsId: 'smsId',
  sender: '+123456789',
  message: 'message',
  receivedAt: '2025-10-05T13:00:35.208Z',
  deviceId: 'deviceId',
  webhookSubscriptionId: 'webhookSubscriptionId',
  webhookEvent: 'MESSAGE_RECEIVED',
}
const message_send_template = {
  smsId: 'smsId',
  smsBatchId: "smsBatchId",
  message: 'message',
  status: "delivered",
  recipient: "+123456789",
  deviceId: 'deviceId',
  webhookSubscriptionId: 'webhookSubscriptionId',
}

const sms_delivered_payload = {
  ...message_send_template,
  sentAt: "2025-10-05T13:00:35.208Z",
  deliveredAt: '2025-10-05T13:00:35.208Z',
  webhookEvent: 'MESSAGE_DELIVERED',
}
const sms_sent_payload = {
  ...message_send_template,
  status: "sent",
  webhookEvent: 'MESSAGE_SENT',
}

const sms_sent_failed = {
  ...message_send_template,
  status: "failed",
  errorCode: "ErorCode",
  errorMessage: "Error",
  failedAt: "2025-10-05T13:00:35.208Z",
  webhookEvent: 'MESSAGE_FAILED',
}

const VERIFICATION_CODE = `
// Node.js example using crypto
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// Express middleware example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-signature'];
  const payload = req.body;
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process the webhook
  console.log('Webhook verified:', payload);
  res.status(200).send('OK');
});
`

const PYTHON_CODE = `
# Python example using hmac
import hmac
import hashlib
import json
from flask import Flask, request

app = Flask(__name__)

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Signature')
    if not verify_signature(request.json, signature, WEBHOOK_SECRET):
        return 'Invalid signature', 401
        
    # Process the webhook
    print('Webhook verified:', request.json)
    return 'OK', 200
`

export function WebhookDocs() {
  const { t } = useI18n()

  return (
    <Accordion type='multiple' className='w-full space-y-2 sm:space-y-4'>
      <AccordionItem value='delivery' className='border rounded-lg'>
        <AccordionTrigger className='px-3 sm:px-4 hover:no-underline [&[data-state=open]>div]:bg-muted'>
          <div className='flex items-center gap-2 py-2 -my-2 px-2 rounded-md'>
            <AlertCircle className='h-4 w-4' />
            <span className='text-sm sm:text-base'>
              {t('webhookDocs.deliveryInfo')}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className='px-3 sm:px-4 pb-4'>
          <div className='space-y-2 mt-2 text-sm text-muted-foreground'>
            <p>
              {t('webhookDocs.deliveryDescription')}
            </p>
            <ul className='list-disc pl-6 space-y-1'>
              <li>{t('webhookDocs.acceptPost')}</li>
              <li>{t('webhookDocs.return2xx')}</li>
              <li>{t('webhookDocs.processWithin')}</li>
            </ul>
            <p className='mt-2'>
              {t('webhookDocs.retrySchedule')}
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value='implementation' className='border rounded-lg'>
        <AccordionTrigger className='px-4 hover:no-underline [&[data-state=open]>div]:bg-muted'>
          <div className='flex items-center gap-2 py-2 -my-2 px-2 rounded-md'>
            <AlertCircle className='h-4 w-4' />
            <span>{t('webhookDocs.securityGuide')}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className='px-4 pb-4'>
          <Tabs defaultValue='overview' className='w-full mt-4'>
            <TabsList>
              <TabsTrigger value='overview'>{t('admin.overview')}</TabsTrigger>
              <TabsTrigger value='payload'>{t('webhooks.payload')}</TabsTrigger>
              <TabsTrigger value='verification'>
                {t('webhookDocs.verification')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value='overview'>
              <div className='space-y-2 mt-4 text-sm text-muted-foreground'>
                <p>{t('webhookDocs.requestIncludes')}</p>
                <ul className='list-disc pl-6 space-y-1'>
                  <li>{t('webhookDocs.jsonPayload')}</li>
                  <li>{t('webhookDocs.signatureHeader')}</li>
                  <li>
                    {t('webhookDocs.signatureFormat')}
                  </li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value='payload'>
              <div className='space-y-4 mt-4'>
                <h4 className='text-sm font-medium'>
                  {t('webhookDocs.samplePayload')}
                </h4>
                <Tabs defaultValue='message_received'>

                <TabsList>
                  <TabsTrigger value='message_received'>
                    {t('webhookDocs.messageReceived')}
                  </TabsTrigger>
                  <TabsTrigger value='message_sent'>
                    {t('webhookDocs.messageSent')}
                  </TabsTrigger>
                  <TabsTrigger value='message_delivered'>
                    {t('webhookDocs.messageDelivered')}
                  </TabsTrigger>
                  <TabsTrigger value='message_failed'>
                    {t('webhookDocs.messageFailed')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value='message_received'>
                  <Code>{JSON.stringify(message_received_payload, null, 2)}</Code>
                </TabsContent>
                <TabsContent value='message_sent'>
                  <Code>{JSON.stringify(sms_sent_payload, null, 2)}</Code>
                </TabsContent>
                <TabsContent value='message_delivered'>
                  <Code>{JSON.stringify(sms_delivered_payload, null, 2)}</Code>
                </TabsContent>
                <TabsContent value='message_failed'>
                  <Code>{JSON.stringify(sms_sent_failed, null, 2)}</Code>
                </TabsContent>
                </Tabs>
              </div>
            </TabsContent>

            <TabsContent value='verification'>
              <div className='space-y-4 mt-4'>
                <Tabs defaultValue='node'>
                  <TabsList>
                    <TabsTrigger value='node'>Node.js</TabsTrigger>
                    <TabsTrigger value='python'>Python</TabsTrigger>
                  </TabsList>

                  <TabsContent value='node'>
                    <Code>{VERIFICATION_CODE}</Code>
                  </TabsContent>

                  <TabsContent value='python'>
                    <Code>{PYTHON_CODE}</Code>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
