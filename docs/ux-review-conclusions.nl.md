# UX-conclusies achter dit pakket

Reviewdatum: 14 september 2026. Frontend: `eamonnhanson/ketso-uploader` main, `0e33ea47cac5ee749925572da680a42af2d51cba`. Bekeken backend: `eamonnhanson/ptb-tree-map`, branch `feature/independent-ops-console`, `89f073f02c852583826c5206bff16b8587ebf839`. Actieve productie-SHA/configuratie niet geverifieerd.

De review combineerde codeonderzoek met lokale browserfixtures op 360, 412 en 1100 CSS pixels. Dat is geen echte Androidtest. De melding dat staff de uploader weinig gebruikt is aanleiding voor onderzoek, geen bewezen gevolg van een specifieke interfacekeuze.

## Vastgesteld

- Een foto gaat eerst als origineel, daarna als crop naar R2; vervolgens wordt een reviewrecord apart opgeslagen. Bij een metadatafout stuurde een herhaalde poging beide bestanden opnieuw. Dit is lokaal gereproduceerd.
- De staff-wrapper kon een HTTP 200 met applicatiefout of zonder review-ID als succes doorgeven. De pagina kon bovendien een mislukte localStorage-write na een succesvolle save als uploadfout tonen. Dit volgt uit de implementatie.
- Onderdelen van het formulier bleven wijzigbaar tijdens verzending. Daarmee kon de geselecteerde/zichtbare context verschillen van een gedeeltelijk verstuurde poging.
- Het staffdashboard accepteert alleen foto's. Video, locatiebewijs en volledige statusgeschiedenis ontbreken in deze route; die functionaliteit wordt niet door dit beperkte pakket toegevoegd.
- De bekeken backend bewaart caption, staff-subcategorie en dedicated staff-ID niet in de INSERT. De frontend kan dat niet oplossen. Een lokale cache kan dit gemis tijdelijk verhullen.
- De review vond ook afzonderlijke studentproblemen: donorcourse-link zonder geopend formulier, een fout in de legacy-tokenfallback, en tegenstrijdige ontvangst-/reviewcopy. Deze staffbranch wijzigt de studentenreis niet.

## Keuze voor deze PR

Begin met betrouwbare communicatie over de staff-fotopoging: zichtbare bestandsregels, behoud van bevestigde keys, één onveranderlijke poging, geen dubbele submit, succes uitsluitend na bevestigde referentie, en cachefouten los van ontvangst. Een onbekende ontvangst wordt read-only gecontroleerd. Geen match in een beperkte publieke lijst is onvoldoende grond voor automatisch opnieuw opslaan.

Dit vermindert onnodige byte-overdracht en voorkomt een aantal misleidende toestanden. Het bewijst geen hogere adoptie en vervangt backend-idempotentie of persistente staffmetadata niet. De volledige resterende afhankelijkheden staan in `reliable-staff-photo-upload.md`.

Native bestandspickers, tekstlabels, statusmeldingen en bestaande CropperJS blijven behouden. Geen nieuw framework, service worker, offlinebestandssysteem, authenticatie of videotranscoder. De gekozen 44+ px-knoppen zijn een ontwerpkeuze; WCAG 2.2 AA 2.5.8 noemt 24 × 24 CSS px met uitzonderingen. Keyboardfocus en statuscommunicatie volgen [WCAG 2.2](https://www.w3.org/TR/WCAG22/) 2.1.1, 2.4.7 en 4.1.3. Hints vóór selecteren en duidelijke fouten sluiten aan bij [GOV.UK file upload](https://design-system.service.gov.uk/components/file-upload/). Het onderscheid tussen netwerkfout, HTTP-response en applicatiefout sluit aan bij [web.dev Fetch error handling](https://web.dev/articles/fetch-api-error-handling).

## Eerstvolgende veldtest

Laat circa vijf staffleden met verschillende digitale ervaring op eigen Androidtoestellen een nurseryfoto maken, een verkeerd bestand vervangen, een verbroken verbinding herstellen en uitleggen of KETSO de foto heeft ontvangen. Meet taakvoltooiing zonder hulp, tijd, fouten, extra requests en dubbele records. Test daarnaast tabwissel/discard en TalkBack. Stel vooraf acceptatiecriteria vast; beschouw vijf deelnemers niet als representatieve adoptieschatting.
