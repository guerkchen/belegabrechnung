Gebaut werden soll eine App zur Belegabrechnung. Der User soll eigene Belege hochladen und verwalten können. Der Freigeber soll hochgeladene Belege sichten und freigeben oder ablehnen können. Der Kassenwart soll die freigegebenen Belege zur Auszahlung sehen.

Es gibt drei Persona:
- User
- Freigeber
- Kassenwart

Jeder Beleg kann mindestens die folgendes Status annehmen:
- zur Freigabe
- Freigegeben
- Abgelehnt
- Ausgezahlt

Technische Rahmenbedingungen:
- Das Frontend wird in Bootstrap, HTML und JavaScript entwickelt.
- Das Backend stellen REST Schnittstellen in PHP da.
- Die Authentifizierung erfolgt mittels Azure Users.
- Die Datenhaltung erfolgt in einer MySQL Datenbank.


User Storys:
Als User möchte ich einen Beleg (PDF) hochladen können und Informationen dazu angeben können (Kurze Beschreibung, Betrag, Belegdaten). Die hochgeladenen Belege werden automatisch zur Freigabe weitergeleitet.

Als User möchte ich eine Übersicht über meine hochgeladenen Belege haben. Ich möchte sehen, wie viele Belege sich in welchem Status befinden. Ich möchte in der Lage sein, die Ansicht nach einer Datumsspanne und Status zu filtern. (Ausbaustufe 1)

Als User möchte ich in der Lage sein, Belege, welche noch nicht freigegeben oder abgelehnt wurden, zu löschen oder zu editieren. (Ausbaustufe 2)

Als Freigeber möchte ich, wie ein User, in der Lage sein, selbst Belege hochzuladen. (Ausbaustufe 1)

Als Freigeber möchte ich alle offenen Belege zur Freigabe sehen können.

Als Freigeber möchte ich offene Belege zur Freigabe einsehen und genehmigen oder ablehnen können.

Als Freigeber möchte ich eine Übersicht aller Belege haben, die jemals freigegeben wurden. Ich möchte in der Lage sein, die Ansicht nach einer Datumsspanne und Status zu filtern. (Ausbaustufe 1)

Als Freigeber möchte ich sehen, wer den Beleg zur Freigabe eingereicht hat.

Als Freigeber möchte ich sehen, wer den Beleg freigeben oder abgelehnt hat.


Als Kassenwart möchte ich, wie ein User, in der Lage sein, selbst Belege hochzuladen.

Als Kassenwart möchte ich alle Belege zur Auszahlung (Freigegeben) sehen.

Als Kassenwart möchte ich in der Lage sein, freigegebene Belege in den Status "Ausgezahlt" zu bewegen.

Als Kassenwart möchte ich in der Lage sein, bereits freigegebene Belege abzulehnen (z. B. wenn bei der Auszahlung Unklarheiten auftreten).


Nacharbeiten:  

Als User möchte ich unter "Meine Belege" in der Lage sein, einen Beleg anzuzeigen und zu löschen, wenn er noch im Status "zur_Freigabe" ist.

Als Administrator möchte ich in der Lage sein, über ein Dropdown Menü zwischen den drei Sichtweisen (User, Freigeber, Kassenwart) hin und her zu wechseln.

Als User möchte ich beim Einreichen des Belegs die Möglichkeit haben, ein Konto für die Auszahlung (Name des Kontobesitzers und IBAN) anzugeben. Diese Daten sollen dem Schatzmeister in der Auszahlungsansicht und der Belegansicht sichtbar sein. Die Kontodaten sollen mir nur bei meinen eigenen Belegen angezeigt werden. Der Kassenwart soll alle Kontodaten sehen können. Anderen Usern und den Freigebern wird "<protected>" angezeigt.

Als User möchte ich beim Einreichen eines neuen Belegs die Möglichkeit haben einen Knopf zu drücken "Kontodaten aus letzter Abrechnung laden". Damit werden der Kontoinhaber und die IBAN mit den Daten aus meinem zuletzt eingereichten Beleg befüllt.

Als User möchte ich in der Lage sein, zu meinen eingereichten Beleg ein Kommentar zu hinterlegen. Das Kommentar wird in der Belegansicht mit aufgeführt.