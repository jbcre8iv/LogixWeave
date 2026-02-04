import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";
export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center">
            <Logo size="lg" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-4xl font-bold mb-8">Legal</h1>

        {/* Disclaimer */}
        <section className="mb-12 p-6 bg-muted/50 rounded-lg border">
          <h2 className="text-xl font-bold mb-3">Disclaimer</h2>
          <p className="text-muted-foreground">
            LogixWeave is an independent software tool developed by Justin Bush | JB CRE8IV. <strong>LogixWeave is not
            affiliated with, endorsed by, sponsored by, or in any way officially connected with Rockwell
            Automation, Inc., or any of its subsidiaries or affiliates.</strong>
          </p>
          <p className="text-muted-foreground mt-3">
            "Studio 5000", "Logix", "ControlLogix", "CompactLogix", "RSLogix", and related names are
            trademarks or registered trademarks of Rockwell Automation, Inc. All other trademarks are
            the property of their respective owners.
          </p>
          <p className="text-muted-foreground mt-3">
            This tool is designed to work with exported L5X/L5K files and is provided as-is for
            documentation and analysis purposes only.
          </p>
        </section>

        {/* Terms of Service */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4" id="terms">Terms of Service</h2>
          <p className="text-sm text-muted-foreground mb-4">Last updated: February 4, 2026</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-4">
            <h3 className="text-lg font-semibold mt-6">1. Acceptance of Terms</h3>
            <p className="text-muted-foreground">
              By accessing or using LogixWeave ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use the Service.
            </p>

            <h3 className="text-lg font-semibold mt-6">2. Description of Service</h3>
            <p className="text-muted-foreground">
              LogixWeave is a web-based toolkit for parsing, analyzing, and documenting Rockwell Automation
              Studio 5000 project files (L5X/L5K format). The Service allows users to upload files, explore
              tags and routines, view I/O configurations, and export documentation.
            </p>

            <h3 className="text-lg font-semibold mt-6">3. User Accounts</h3>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activities that occur under your account. You agree to notify us immediately of any unauthorized
              use of your account.
            </p>

            <h3 className="text-lg font-semibold mt-6">4. User Content</h3>
            <p className="text-muted-foreground">
              You retain ownership of all files and data you upload to the Service ("User Content"). By uploading
              content, you grant us a limited license to store, process, and display your content solely for the
              purpose of providing the Service to you. We do not claim any ownership rights over your User Content.
            </p>

            <h3 className="text-lg font-semibold mt-6">5. Acceptable Use</h3>
            <p className="text-muted-foreground">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
              <li>Upload malicious files or content</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the intellectual property rights of others</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6">6. Intellectual Property</h3>
            <p className="text-muted-foreground">
              The Service, including its original content, features, and functionality, is owned by Justin Bush
              and is protected by international copyright, trademark, and other intellectual property laws.
            </p>
            <p className="text-muted-foreground mt-2">
              "Studio 5000", "Logix", "ControlLogix", "CompactLogix", "RSLogix", and "Rockwell Automation"
              are trademarks or registered trademarks of Rockwell Automation, Inc. <strong>LogixWeave is not
              affiliated with, endorsed by, sponsored by, or officially connected with Rockwell Automation,
              Inc. or any of its subsidiaries or affiliates.</strong> Any use of these trademarks is for
              identification purposes only.
            </p>

            <h3 className="text-lg font-semibold mt-6">7. Software Protection</h3>
            <p className="text-muted-foreground">
              The LogixWeave software, including all source code, algorithms, processes, user interfaces, designs,
              and documentation, is the exclusive property of Justin Bush and is protected by copyright and other
              intellectual property laws. You may not:
            </p>
            <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
              <li>Copy, modify, or distribute the Service or any part thereof</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Attempt to derive the source code or underlying algorithms</li>
              <li>Remove or alter any proprietary notices or labels</li>
              <li>Use the Service to build a competing product or service</li>
              <li>Sublicense, rent, lease, or transfer any rights in the Service</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6">8. Disclaimer of Warranties</h3>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
              OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. JUSTIN BUSH DOES NOT WARRANT THAT THE SERVICE WILL
              BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. YOU ASSUME
              ALL RESPONSIBILITY AND RISK FOR YOUR USE OF THE SERVICE AND YOUR RELIANCE ON ANY INFORMATION OR
              RESULTS OBTAINED THROUGH THE SERVICE.
            </p>
            <p className="text-muted-foreground mt-2">
              THE SERVICE IS PROVIDED FOR DOCUMENTATION AND ANALYSIS PURPOSES ONLY. JUSTIN BUSH MAKES NO WARRANTY
              OR REPRESENTATION REGARDING THE ACCURACY, COMPLETENESS, OR RELIABILITY OF ANY PARSED DATA, ANALYSIS,
              OR DOCUMENTATION GENERATED BY THE SERVICE. YOU SHOULD INDEPENDENTLY VERIFY ALL INFORMATION BEFORE
              RELYING ON IT FOR ANY PURPOSE.
            </p>

            <h3 className="text-lg font-semibold mt-6">9. Limitation of Liability</h3>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL JUSTIN BUSH BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT
              LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, EVEN IF
              ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-muted-foreground mt-2">
              IN NO EVENT SHALL JUSTIN BUSH'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING
              TO THE SERVICE EXCEED THE AMOUNT YOU PAID TO USE THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING
              THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
            </p>
            <p className="text-muted-foreground mt-2">
              JUSTIN BUSH SHALL NOT BE LIABLE FOR ANY DAMAGES, LOSSES, OR INJURIES ARISING FROM: (A) YOUR USE OR
              INABILITY TO USE THE SERVICE; (B) ANY ERRORS, INACCURACIES, OR OMISSIONS IN THE SERVICE OR ITS
              CONTENT; (C) UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR DATA; (D) ANY ACTIONS TAKEN BASED ON
              INFORMATION PROVIDED BY THE SERVICE; OR (E) ANY ISSUES WITH YOUR PLC SYSTEMS, EQUIPMENT, OR PROCESSES.
            </p>

            <h3 className="text-lg font-semibold mt-6">10. Indemnification</h3>
            <p className="text-muted-foreground">
              You agree to indemnify, defend, and hold harmless Justin Bush from and against any and all claims,
              damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorney's fees)
              arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of
              any third-party rights, including intellectual property rights; (d) any content you upload or submit
              to the Service; or (e) any claims that your use of the Service caused damage to a third party.
            </p>

            <h3 className="text-lg font-semibold mt-6">11. No Professional Advice</h3>
            <p className="text-muted-foreground">
              The Service is not intended to provide professional engineering, safety, or technical advice. The
              information and analysis provided by the Service is for informational purposes only and should not
              be used as a substitute for professional judgment. You are solely responsible for ensuring the safety
              and proper operation of your PLC systems and equipment.
            </p>

            <h3 className="text-lg font-semibold mt-6">12. Governing Law and Dispute Resolution</h3>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the State of Maryland,
              United States, without regard to its conflict of law provisions. Any dispute arising out of or
              relating to these Terms or the Service shall be resolved exclusively in the state or federal courts
              located in Maryland, and you consent to the personal jurisdiction of such courts.
            </p>

            <h3 className="text-lg font-semibold mt-6">13. Changes to Terms</h3>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time at our sole discretion. We will notify users
              of any material changes by posting the new terms on this page and updating the "Last updated" date.
              Your continued use of the Service after changes constitutes acceptance of the new terms. If you do
              not agree to the modified terms, you must stop using the Service.
            </p>

            <h3 className="text-lg font-semibold mt-6">14. Termination</h3>
            <p className="text-muted-foreground">
              We may terminate or suspend your access to the Service immediately, without prior notice or liability,
              for any reason whatsoever, including without limitation if you breach these Terms. Upon termination,
              your right to use the Service will cease immediately. All provisions of these Terms which by their
              nature should survive termination shall survive, including ownership provisions, warranty disclaimers,
              indemnity, and limitations of liability.
            </p>

            <h3 className="text-lg font-semibold mt-6">15. Severability</h3>
            <p className="text-muted-foreground">
              If any provision of these Terms is held to be invalid or unenforceable, such provision shall be
              modified to the minimum extent necessary to make it valid and enforceable, and the remaining
              provisions shall continue in full force and effect.
            </p>

            <h3 className="text-lg font-semibold mt-6">16. Entire Agreement</h3>
            <p className="text-muted-foreground">
              These Terms constitute the entire agreement between you and Justin Bush regarding the Service and
              supersede all prior agreements and understandings, whether written or oral, regarding the Service.
            </p>
          </div>
        </section>

        {/* Privacy Policy */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4" id="privacy">Privacy Policy</h2>
          <p className="text-sm text-muted-foreground mb-4">Last updated: February 4, 2026</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-4">
            <h3 className="text-lg font-semibold mt-6">1. Information We Collect</h3>
            <p className="text-muted-foreground">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
              <li>Account information (name, email address)</li>
              <li>Project files you upload (L5X/L5K files)</li>
              <li>Usage data and analytics</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6">2. How We Use Your Information</h3>
            <p className="text-muted-foreground">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and store your uploaded files</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6">3. Data Storage and Security</h3>
            <p className="text-muted-foreground">
              Your data is stored securely using industry-standard encryption and security practices. We use
              Supabase for database and authentication services, and Vercel for hosting. Your uploaded files
              are stored in secure cloud storage with access controls.
            </p>

            <h3 className="text-lg font-semibold mt-6">4. Data Sharing</h3>
            <p className="text-muted-foreground">
              We do not sell, trade, or otherwise transfer your personal information to third parties. We may
              share data with service providers who assist in operating the Service (e.g., hosting providers),
              but only to the extent necessary for them to provide their services.
            </p>

            <h3 className="text-lg font-semibold mt-6">5. Your Rights</h3>
            <p className="text-muted-foreground">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and associated data</li>
              <li>Export your data</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6">6. Cookies</h3>
            <p className="text-muted-foreground">
              We use essential cookies required for the Service to function, including authentication tokens.
              We do not use tracking or advertising cookies.
            </p>

            <h3 className="text-lg font-semibold mt-6">7. Children's Privacy</h3>
            <p className="text-muted-foreground">
              The Service is not intended for children under 13 years of age. We do not knowingly collect
              personal information from children under 13.
            </p>

            <h3 className="text-lg font-semibold mt-6">8. Changes to This Policy</h3>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              posting the new policy on this page and updating the "Last updated" date.
            </p>

            <h3 className="text-lg font-semibold mt-6">9. Contact Us</h3>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:support@jbcre8iv.com" className="text-primary hover:underline">
                support@jbcre8iv.com
              </a>.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="border-t pt-8">
          <h2 className="text-xl font-semibold mb-4">Contact</h2>
          <p className="text-muted-foreground">
            LogixWeave is operated by Justin Bush | JB CRE8IV as an individual.
          </p>
          <p className="text-muted-foreground mt-2">
            For support or legal inquiries, please contact us at{" "}
            <a href="mailto:support@jbcre8iv.com" className="text-primary hover:underline">
              support@jbcre8iv.com
            </a>.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} LogixWeave. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
