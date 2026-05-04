# Progress

## Pågående oppgave
SongContentSheet CSS-fiks — sheet vises som full hvit side i stedet for bottom sheet overlay.

## Gjort
- Byttet className i SongContentSheet.tsx: `h-[85vh] flex flex-col` → `max-h-[85vh] data-[state=open]:flex data-[state=open]:flex-col`

## Gjenstår
(ingenting)

## Avveininger
CSS-spesifisitetskollisjon mellom shadcn base-klasser og bruker-overrides. Løses med data-variant-klasser i stedet for nakne utility-klasser.
