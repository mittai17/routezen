import Link from "next/link";
import type { LegalSection } from "./legal-page";

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;

export const privacy: LegalSection[] = [
  { heading: "What this covers", body: <P>RouteZen is a delivery route planning tool for Chennai. This draft describes the data this version handles. Who is responsible for that data (the &quot;operator&quot;) depends on who deploys it; the operator must be named here before launch.</P> },
  { heading: "Data you enter", body: (<><P>You enter locations, packages (reference, recipient name, address, weight, deadlines), vehicle profiles, plans, scenarios, delivery status events and workspace settings. Recipient names and addresses can be personal data. Enter only what you need to plan a delivery.</P><P>This version has no user accounts or sign-in. All data belongs to a single shared workspace in the backend database, so anyone who can reach a deployment can read and change that workspace. Do not expose it publicly with real customer data.</P></>) },
  { heading: "Third parties your browser or server contacts", body: (<ul><li><strong>Routing service (OSRM).</strong> The backend sends stop coordinates to the configured OSRM server to obtain road distances and geometry. The default public demo server is not meant for production or personal data.</li><li><strong>Map tiles.</strong> Your browser requests tiles from OpenStreetMap or Esri World Imagery, which can see your IP address and the map area you view.</li><li><strong>Fonts.</strong> Fonts may be fetched from Google Fonts at build time; check your deployment.</li></ul>) },
  { heading: "What stays in your browser", body: <P>The app stores your light/dark theme choice in local storage. In demo mode it also keeps settings in local storage. See the <Link href="/cookies">Cookies and storage</Link> page.</P> },
  { heading: "Not collected by this version", body: <P>RouteZen does not include advertising, analytics or tracking scripts and does not read a vehicle&apos;s GPS position. Tracking relies only on status events that people report manually.</P> },
  { heading: "Retention and deletion", body: <P>Data stays in the database until someone deletes it using the app or database tools. There is no automatic retention schedule yet; the operator must define one. Optimisation run history is held in server memory and is lost on restart.</P> },
  { heading: "Your rights and requests", body: <P>Rights depend on where you and the operator are located. The operator must publish a contact and process for access, correction and deletion requests before commercial launch (see <Link href="/contact">Contact</Link>).</P> },
  { heading: "Security", body: <P>The current build has no authentication and is intended for development and evaluation. We make no claim of certification or audit. Production use requires access control, transport encryption and backups configured by the operator.</P> },
  { heading: "Changes", body: <P>This draft will change as the product does. Material changes should be dated and announced once a version is published.</P> },
];

export const terms: LegalSection[] = [
  { heading: "Using RouteZen", body: <P>RouteZen helps you plan delivery routes and compare vehicle options. By using it you agree to these draft terms. If you use it for an organisation, you confirm you may act for it.</P> },
  { heading: "Planning aid, not a guarantee", body: <P>Distances, times, costs, energy use and emissions are estimates from your inputs, vehicle profiles marked with a verification level, and an external routing service. Real conditions differ. You remain responsible for driver safety, traffic law, load limits and delivery commitments.</P> },
  { heading: "Simulation and quantum features", body: <P>The quantum option is a classical simulation of the QAOA algorithm and is labelled as such. It does not use quantum hardware and the product does not promise it will outperform classical solvers.</P> },
  { heading: "Demo data", body: <P>Anything labelled &quot;Demo data&quot; is illustrative. Do not rely on it for decisions.</P> },
  { heading: "Your content", body: <P>You keep ownership of the data you enter. You are responsible for having the right to enter it, including any personal data about recipients.</P> },
  { heading: "Acceptable use", body: <P>Use must follow the <Link href="/acceptable-use">Acceptable Use</Link> draft.</P> },
  { heading: "Availability and changes", body: <P>The service is early-stage and provided as is, without a service level. Features may change or be removed. Check <Link href="/status">System status</Link> for current component checks.</P> },
  { heading: "Liability", body: <P>[Liability, warranty and governing-law wording to be supplied by qualified legal counsel before commercial launch.]</P> },
];

export const cookies: LegalSection[] = [
  { heading: "Summary", body: <P>This version of RouteZen does not set cookies of its own and has no sign-in. It uses your browser&apos;s local storage for two conveniences.</P> },
  { heading: "What is stored", body: (<ul><li><code>routezen-theme</code>: your light or dark theme choice. Stays on your device.</li><li><code>routezen.demo.settings</code>: only in demo mode, saved workspace settings so they survive a reload.</li></ul>) },
  { heading: "Third-party requests", body: <P>Map tiles (OpenStreetMap, Esri) are requested directly by your browser. Those providers may set their own cookies or log requests under their own policies. Check your deployment for any additional services.</P> },
  { heading: "Controlling storage", body: <P>You can clear local storage for this site in your browser settings. The app will fall back to defaults. If a deployment adds analytics or other non-essential cookies, this page and a consent mechanism must be updated first.</P> },
];

export const acceptableUse: LegalSection[] = [
  { heading: "Purpose", body: <P>These rules keep RouteZen safe to run and fair to others.</P> },
  { heading: "Do not", body: (<ul><li>Enter unlawful content or personal data you have no right to process.</li><li>Probe, scan or overload the service or the routing and map providers it relies on, including bulk requests to the public OSRM or OpenStreetMap servers.</li><li>Attempt to access data or systems you are not authorised to access.</li><li>Present simulated, demo or estimated output as measured fact, including quantum-simulation results as proof of quantum advantage.</li><li>Use the product to plan deliveries that violate traffic, safety, labour or cargo regulations.</li></ul>) },
  { heading: "Responsible disclosure", body: <P>If you find a security problem, report it through the <Link href="/contact">contact channel</Link> rather than publishing it.</P> },
  { heading: "Enforcement", body: <P>[Enforcement and suspension process to be defined by the operator and reviewed by counsel.]</P> },
];

export const accessibility: LegalSection[] = [
  { heading: "Our aim", body: <P>We aim to make RouteZen usable with a keyboard and screen reader and readable in light and dark themes. We design toward WCAG 2.2 AA but have not completed a formal audit, so we do not claim conformance.</P> },
  { heading: "What we have built in", body: (<ul><li>A skip-to-content link and landmark regions.</li><li>Labels and error messages on form fields; status is never conveyed by colour alone.</li><li>Charts include text values and legends; tables have captions or headers.</li><li>Layouts adapt down to phone width.</li></ul>) },
  { heading: "Known limitations", body: (<ul><li>The interactive map is mouse and touch oriented. The same stops are listed in text beside it.</li><li>Charts are summarised for assistive tech but are not fully navigable point by point.</li><li>Manual testing with assistive technology is still pending.</li></ul>) },
  { heading: "Feedback", body: <P>If something blocks you, tell us via <Link href="/contact">Contact</Link> with the page and what you were doing.</P> },
];
