"""Transcribe supplied categories; not a federation or registration certification."""
import json
from pathlib import Path

rows = [
 ('Básquet','equipo','Mosquitos|U9|U11 (Mini)|U13|U15|U17|U21|Superior|Máster',['Básquet Caballeros','Básquet Damas']),
 ('Rugby','equipo','|'.join('M'+str(i) for i in range(5,20))+'|Mayores',['Rugby Caballeros','Rugby Damas']),
 ('Hockey sobre patines','equipo','Mini|Promo|Infantil|Prejuvenil|Juvenil|Junior|Primera',['Hockey sobre Patines Caballeros','Hockey sobre Patines Damas']),
 ('Karate','grupo','Sub 14|Cadetes|Junior|Sub 21|Senior',['Karate']),
 ('Gimnasia rítmica','grupo','Age Group AC2|AC3|AC4|Junior|Senior',['Gimnasia Rítmica']),
 ('Pelota paleta','equipo','Infantil|Menores|Juvenil|Sub 22|Primera/Mayores',['Pelota Paleta']),
 ('Patín artístico','grupo','Iniciación/Promocional|Quinta|Cuarta|Tercera|Segunda|Primera|Internacional',['Patín Artístico']),
 ('Judo','grupo','Iniciación|Juvenil Sub 13|Juvenil Sub 15|Cadetes Sub 18|Junior Sub 21|Senior|Máster',['Judo']),
 ('Natación artística','grupo','Infantil A|Infantil B|Juvenil|Junior|Senior/Mayores|Máster',['Natación Artística']),
 ('Golf','grupo','Birdies|Eagles|Albatros|Prejuveniles (M15)|Juveniles (M18)|Aficionados/Mayores',['Golf']),
 ('Cestoball','equipo','Sub 10|Sub 12|Sub 14|Sub 17|Primera División|Maxi (+30)',['Cestoball']),
 ('Gimnasia artística','grupo','Premini|Mini|Preinfantil|Infantil|Juvenil|Mayores',['Gimnasia Artística']),
 ('Tenis','grupo','Sub 10|Sub 12|Sub 14|Sub 16|Sub 18|Mayores',['Tenis']),
 ('Vóley','equipo','Sub 12|Sub 14|Sub 16|Sub 18|Sub 21|Mayores/División de Honor',['Vóley Caballeros','Vóley Damas']),
 ('Hockey sobre césped','equipo','Décima|Novena|Octava|Séptima|Sexta|Quinta|Intermedia|Primera|Cuarta',['Hockey sobre Césped Caballeros','Hockey sobre Césped Damas']),
]
sports=[]
for name,kind,cats,activities in rows:
 categories=cats.split('|')
 sports.append(dict(name=name,kind=kind,categories=categories,divisions=[dict(activity=a,categories=categories,teams=['A','B']) for a in activities]))
taff=[]
for years,codes in [('18/19','C B N A R'),('16/17','C B N A R AZ V'),('14/15','C B N A R AZ V NE'),('12/13','C B A R AZ NE')]:
 taff.extend(years+' '+code for code in codes.split())
# Each football code is the category verbatim; modality is the existing equipo axis.
divisions=[dict(activity='Fútbol Caballeros',categories=taff,teams=['FUTBOL TAFF MASC']),dict(activity='Fútbol Caballeros',categories=['Septima','Sexta','Quinta','Cuarta'],teams=['FUTBOL 11']),dict(activity='Fútbol Caballeros',categories=['C','B','AZ','NE'],teams=['FUTBOL TIFA']),dict(activity='Fútbol Damas',categories=['SUB 12/10 C','SUB 12/10 B','SUB 14','SUB 17 C','SUB 17 B'],teams=['FUTBOL FEMENINO'])]
sports.append(dict(name='Fútbol',kind='equipo',categories=taff,divisions=divisions))
out=Path(__file__).resolve().parents[1]/'demo'
out.mkdir(exist_ok=True)
(out/'catalogo.json').write_text(json.dumps(dict(startDate='2026-07-27',sports=sports),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
