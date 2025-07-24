import emailjs from '@emailjs/browser'

const EMAILJS_CONFIG = {
  serviceId: 'service_yk0hpw9',
  publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!,
  templates: {
    welcome: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_WELCOME!,
    licenseActivated: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_LICENSE!,
    bookingConfirmation: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING!,
    commissionPaid: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_COMMISSION!,
    passwordReset: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_PASSWORD!,
    affiliateInvite: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_AFFILIATE!,
    systemNotification: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_SYSTEM!
  }
}

export class EmailService {
  private static instance: EmailService

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  async sendWelcomeEmail(userEmail: string, userName: string, planType: string) {
    return this.sendEmail(EMAILJS_CONFIG.templates.welcome, {
      to_email: userEmail,
      to_name: userName,
      plan_type: planType,
      app_name: 'Lunara Afiliados',
      login_url: `${process.env.NEXT_PUBLIC_APP_URL}/login`
    })
  }

  async sendLicenseActivatedEmail(userEmail: string, userName: string, licenseType: string) {
    return this.sendEmail(EMAILJS_CONFIG.templates.licenseActivated, {
      to_email: userEmail,
      to_name: userName,
      license_type: licenseType,
      app_name: 'Lunara Afiliados',
      dashboard_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    })
  }

  async sendBookingConfirmationEmail(
    clientEmail: string,
    clientName: string,
    serviceName: string,
    scheduledDate: string,
    servicePrice: number,
    professionalName: string
  ) {
    return this.sendEmail(EMAILJS_CONFIG.templates.bookingConfirmation, {
      to_email: clientEmail,
      to_name: clientName,
      service_name: serviceName,
      scheduled_date: scheduledDate,
      service_price: servicePrice.toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }),
      professional_name: professionalName,
      app_name: 'Lunara Afiliados'
    })
  }

  async sendCommissionPaidEmail(
    affiliateEmail: string,
    affiliateName: string,
    commissionAmount: number,
    bookingDetails: string
  ) {
    return this.sendEmail(EMAILJS_CONFIG.templates.commissionPaid, {
      to_email: affiliateEmail,
      to_name: affiliateName,
      commission_amount: commissionAmount.toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }),
      booking_details: bookingDetails,
      app_name: 'Lunara Afiliados'
    })
  }

  async sendPasswordResetEmail(userEmail: string, userName: string, resetToken: string) {
    return this.sendEmail(EMAILJS_CONFIG.templates.passwordReset, {
      to_email: userEmail,
      to_name: userName,
      reset_link: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`,
      app_name: 'Lunara Afiliados'
    })
  }

  async sendAffiliateInviteEmail(
    inviteEmail: string,
    inviterName: string,
    referralCode: string
  ) {
    return this.sendEmail(EMAILJS_CONFIG.templates.affiliateInvite, {
      to_email: inviteEmail,
      inviter_name: inviterName,
      referral_code: referralCode,
      signup_link: `${process.env.NEXT_PUBLIC_APP_URL}/auth/register?ref=${referralCode}`,
      app_name: 'Lunara Afiliados'
    })
  }

  async sendSystemNotificationEmail(
    adminEmail: string,
    subject: string,
    message: string
  ) {
    return this.sendEmail(EMAILJS_CONFIG.templates.systemNotification, {
      to_email: adminEmail,
      subject,
      message,
      app_name: 'Lunara Afiliados',
      timestamp: new Date().toLocaleString('pt-BR')
    })
  }

  private async sendEmail(templateId: string, params: any) {
    try {
      const response = await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        templateId,
        {
          ...params,
          from_name: 'Lunara Afiliados',
          reply_to: 'noreply@lunara-afiliados.com'
        },
        EMAILJS_CONFIG.publicKey
      )

      return { success: response.status === 200, response }
    } catch (error) {
      console.error('Email sending failed:', error)
      return { success: false, error: error.message }
    }
  }
}

export const emailService = EmailService.getInstance()