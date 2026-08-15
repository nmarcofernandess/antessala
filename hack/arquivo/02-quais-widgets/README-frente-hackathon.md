# hack/specs — frente do hackathon

Espaço de trabalho das frentes paralelas do HackaHelpth. Os specs do produto ficam em
`/specs`; aqui fica o que nasce de fora do time de código.

## Aberto agora

### `02-quais-widgets/` — catálogo de widgets e templates da anamnese
**Responsável:** Zan · **Status:** aguardando

O que precisa sair daqui:

1. **Quais blocos de perguntas** a triagem pré-anestésica precisa ter.
2. **Quais o DietFlow já tem prontos** para a gente trazer (hoje são 8: rotina alimentar,
   hidratação, sono, bristol, problemas de saúde, medicações, adesão, observações gerais —
   os dois últimos clínicos já vêm com base de medicamentos e código de diagnóstico).
3. **Quais precisam ser criados do zero**, e o que cada um pergunta.
4. **Os templates**: qual o conjunto do *template básico* e quais os *templates por caso*
   (pré-operatório X, pré-operatório Y, atendimento rápido para pegar a pulseira com o ID).

Formato livre — tabela, lista ou HTML. O que importa é cada linha responder: nome do
bloco, o que pergunta, se já existe no DietFlow, se é obrigatório, e em quais templates
entra.

## Antes de escrever

Leia, nesta ordem:

1. `/specs/000-produto-antessala/analysis.md` — o produto, as quatro telas, os invariantes
2. `/specs/001-preparar-ambiente/spec.md` — o que fica e o que sai do casco
3. `/docs/PLANO.html` — o plano de trabalho e a divisão de frentes
4. `/docs/INVENTARIO.html` — o que cada base já tem pronto

Duas leis que valem aqui também: o paciente **não é cadastrado** (id descartável, sem
histórico) e **não existe evolução** na anamnese.
