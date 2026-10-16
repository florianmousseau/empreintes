// Les autorites des listes de confiance (D-164) : lues sur une LOTL et une liste
// nationale ecrites ici dans la forme ETSI TS 119 612, prefixes compris.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PLANCHER_AUTORITES, TYPE_CA_QC, autoritesDeLaListe, listesNationales, registreDesAutorites } from '../src/confiance.mjs';

const pointeur = (pays, url, type) => `<OtherTSLPointer><TSLLocation>${url}</TSLLocation><AdditionalInformation><OtherInformation><SchemeTerritory>${pays}</SchemeTerritory></OtherInformation><OtherInformation><ns3:MimeType>${type}</ns3:MimeType></OtherInformation></AdditionalInformation></OtherTSLPointer>`;
const LOTL = `<TrustServiceStatusList><SchemeInformation><PointersToOtherTSL>${[
	pointeur('FR', 'https://www.ssi.gouv.fr/uploads/tl-fr.xml', 'application/vnd.etsi.tsl+xml'),
	pointeur('FR', 'https://www.ssi.gouv.fr/uploads/tl-fr.pdf', 'application/pdf'),
	pointeur('EU', 'https://ec.europa.eu/tools/lotl/eu-lotl.xml', 'application/vnd.etsi.tsl+xml'),
	pointeur('IT', 'https://eidas.agid.gov.it/TL/TSL-IT.xml?a=1&amp;b=2', 'text/xml')
].join('')}</PointersToOtherTSL></SchemeInformation></TrustServiceStatusList>`;

const CERT_A = Buffer.from('certificat A').toString('base64');
const CERT_B = Buffer.from('certificat B').toString('base64');
const CERT_C = Buffer.from('certificat C').toString('base64');
const information = ({ type = TYPE_CA_QC, statut = 'granted', depuis = '2016-07-01T00:00:00Z', nom = 'CA de test', certificats = [CERT_A], usages = [] }) => `
<tsl:ServiceTypeIdentifier>${type}</tsl:ServiceTypeIdentifier>
<tsl:ServiceName><tsl:Name xml:lang="en">${nom}</tsl:Name><tsl:Name xml:lang="fr">autre</tsl:Name></tsl:ServiceName>
<tsl:ServiceDigitalIdentity>${certificats.map((c) => `<tsl:DigitalId><tsl:X509Certificate>\n${c.match(/.{1,8}/g).join('\n')}\n</tsl:X509Certificate></tsl:DigitalId>`).join('')}</tsl:ServiceDigitalIdentity>
<tsl:ServiceStatus>http://uri.etsi.org/TrstSvc/TrustedList/Svcstatus/${statut}</tsl:ServiceStatus>
${depuis ? `<tsl:StatusStartingTime>${depuis}</tsl:StatusStartingTime>` : ''}
<tsl:ServiceInformationExtensions>${usages.map((u) => `<tsl:URI xml:lang="en">http://uri.etsi.org/TrstSvc/TrustedList/SvcInfoExt/${u}</tsl:URI>`).join('')}</tsl:ServiceInformationExtensions>`;
/** Un service : son information courante, puis son historique (ETSI TS 119 612, 5.6), du plus recent au plus ancien. */
const service = ({ historique = [], ...courant }) =>
	`<tsl:TSPService><tsl:ServiceInformation>${information(courant)}</tsl:ServiceInformation>${
		historique.length ? `<tsl:ServiceHistory>${historique.map((h) => `<tsl:ServiceHistoryInstance>${information(h)}</tsl:ServiceHistoryInstance>`).join('')}</tsl:ServiceHistory>` : ''
	}</tsl:TSPService>`;

test('la LOTL donne les listes nationales XML, sans elle-meme ni les PDF', () => {
	assert.deepEqual(listesNationales(LOTL), [
		{ pays: 'FR', url: 'https://www.ssi.gouv.fr/uploads/tl-fr.xml' },
		{ pays: 'IT', url: 'https://eidas.agid.gov.it/TL/TSL-IT.xml?a=1&b=2' }
	]);
});

test('une liste nationale donne ses autorites CA/QC qui ont ete en vigueur, avec leurs periodes', () => {
	const xml = [
		service({ nom: 'Cachets &amp; signatures', usages: ['ForeSeals', 'ForeSignatures', 'ForWebSiteAuthentication', 'ForeSeals'] }),
		service({ nom: 'Jamais accordee', statut: 'withdrawn', certificats: [CERT_B] }),
		service({ nom: 'Horodatage', type: 'http://uri.etsi.org/TrstSvc/Svctype/TSA/QTST', certificats: [CERT_B] }),
		service({
			nom: 'Retiree',
			statut: 'withdrawn',
			depuis: '2018-06-01T00:00:00Z',
			certificats: [CERT_B],
			historique: [
				{ depuis: '2016-06-30T22:00:00Z', certificats: [] },
				{ statut: 'accredited', depuis: '2011-11-16T23:00:00Z', certificats: [CERT_C] },
				{ type: 'http://uri.etsi.org/TrstSvc/Svctype/CA/PKC', depuis: '2005-01-01T00:00:00Z', certificats: [] }
			]
		}),
		service({ nom: 'Suspendue puis rendue', depuis: '2022-01-01T00:00:00Z', historique: [{ statut: 'withdrawn', depuis: '2021-01-01T00:00:00Z' }, { depuis: '2017-01-01T00:00:00Z' }] }),
		service({ nom: 'Sans date', depuis: null })
	].join('');
	assert.deepEqual(autoritesDeLaListe(xml), [
		{ nom: 'Cachets & signatures', usages: ['cachets', 'signatures'], certificats: [CERT_A], periodes: [['2016-07-01T00:00:00Z', null]] },
		{ nom: 'Retiree', usages: [], certificats: [CERT_B, CERT_C], periodes: [['2011-11-16T23:00:00Z', '2018-06-01T00:00:00Z']] },
		{
			nom: 'Suspendue puis rendue',
			usages: [],
			certificats: [CERT_A],
			periodes: [
				['2017-01-01T00:00:00Z', '2021-01-01T00:00:00Z'],
				['2022-01-01T00:00:00Z', null]
			]
		},
		{ nom: 'Sans date', usages: [], certificats: [CERT_A], periodes: [[null, null]] }
	]);
	assert.deepEqual(autoritesDeLaListe('<tsl:TSPService><tsl:ServiceTypeIdentifier>x</tsl:ServiceTypeIdentifier></tsl:TSPService>'), []);
});

test('le registre indexe chaque certificat par son sha256 ; une liste muette ou un certificat mal encode ne fait rien tomber', async () => {
	const r = await registreDesAutorites(
		[
			{ pays: 'FR', xml: service({ nom: 'CA FR', usages: ['ForeSeals'], certificats: [CERT_A, '%%%%'] }) },
			{ pays: 'BG', xml: null },
			{ pays: 'AT', xml: null },
			{ pays: 'IT', xml: service({ nom: 'CA IT', certificats: [CERT_B] }) },
			{ pays: 'IT', xml: service({ nom: 'CA IT bis', statut: 'withdrawn', depuis: '2020-01-01T00:00:00Z', certificats: [CERT_B], historique: [{ depuis: '2012-01-01T00:00:00Z', certificats: [] }] }) }
		],
		'2026-10-15T05:00:00.000Z'
	);
	const h = (b64) => createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');
	assert.deepEqual(r, {
		lu: '2026-10-15T05:00:00.000Z',
		illisibles: ['AT', 'BG'],
		autorites: {
			[h(CERT_A)]: { pays: 'FR', nom: 'CA FR', usages: ['cachets'], periodes: [['2016-07-01T00:00:00Z', null]] },
			[h(CERT_B)]: {
				pays: 'IT',
				nom: 'CA IT',
				usages: [],
				periodes: [
					['2012-01-01T00:00:00Z', '2020-01-01T00:00:00Z'],
					['2016-07-01T00:00:00Z', null]
				]
			}
		}
	});
	assert.ok(PLANCHER_AUTORITES >= 500, 'les listes portent pres de mille certificats CA/QC en vigueur (992 le 15/10/2026)');
});
