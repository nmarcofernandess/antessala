# Writing plan — MiniSpec 001 · Contrato operacional

**Estado:** `EXECUTÁVEL SOMENTE PARA DISCOVERY`

**Resultado permitido:** contrato, evidência, decisão ou bloqueio

**Resultado proibido:** código de produto

---

## Passo 0 · Checar o gate antes de trabalhar

1. Ler o estado vigente do [`../../ANALYST.md`](../../ANALYST.md).
2. Confirmar que pesquisa/consolidação está `PASS` e que a MiniSpec 001 continua sendo a
   única liberada.
3. Confirmar que o trabalho não altera produto, schema, tela, widget, regra ou agenda.

Se qualquer condição falhar, **PARAR** e registrar o motivo no Warlog. O `NO-GO PARA
BUILD` atual não bloqueia esta descoberta; ele a limita.

## Passo 1 · Preparar a coleta sem expor pacientes

1. Nomear responsáveis reais por operação, anestesiologia, agendamento e TI.
2. Combinar quais telas, formulários e agendas podem ser demonstrados.
3. Definir anonimização, consentimento, retenção e local autorizado para evidências.
4. Preparar as perguntas G1–G8 sem oferecer respostas ou termos do produto antigo.

**Saída:** agenda de sessões, responsáveis e protocolo de manuseio da evidência. Sem
autorização ou representante, marcar o gate correspondente como bloqueado.

## Passo 2 · Observar um caso ponta a ponta

1. Acompanhar o evento que dispara a CPA até o resultado da consulta.
2. Registrar ator, sistema/tela, campo, estado, handoff, espera e exceção em cada etapa.
3. Registrar se a cirurgia possui data, janela, prioridade ou nenhuma marcação.
4. Separar o que foi visto do que o participante apenas supôs ou relembrou.

**Saída:** evidência E1 e primeira versão factual do fluxo E2. Se não houver demonstração
real ou documento equivalente, não desenhar o trecho ausente.

## Passo 3 · Explicar “agendamento semelhante”

1. Observar uma semana anonimizada da agenda e a configuração dos tipos de vaga.
2. Comparar dois casos reais anonimizados que deveriam receber tratamento diferente.
3. Identificar qual dimensão permanece igual: ordem, antecedência, duração, modalidade,
   profissional, local, preparo ou visibilidade.
4. Verificar em qual ponto a informação necessária existe e por que não muda a vaga.

**Saída:** E4, com dimensão, evidência, dono da decisão e efeito operacional. Se o HC não
conseguir definir “semelhante”, registrar esse fato como bloqueio central.

## Passo 4 · Validar atores, autoridade e swimlane

1. Listar cada ação observada e o dado lido ou escrito.
2. Confirmar quem solicita, coleta, corrige, classifica, revisa, agenda e reabre.
3. Distinguir cargo, papel funcional e pessoa; registrar quando alguém acumula papéis.
4. Submeter o swimlane aos representantes dos setores e guardar a forma de validação.

**Saída:** E3. Nenhuma tela ou permissão futura será derivada de ator não validado.

## Passo 5 · Mapear sistemas e identidade

1. Para cada etapa, registrar sistema, tela, chave e dono.
2. Distinguir paciente, solicitação, procedimento, caso, vaga e agendamento.
3. Verificar o papel de Iris, Athos, SIRESP, sistema cirúrgico e interfaces humanas.
4. Solicitar documentação de API/exportação; sem ela, classificar a fronteira como mock.

**Saída:** E5 e decisão de identidade. Não declarar integração por aparência de tela ou
nome de sistema.

## Passo 6 · Fechar o dicionário de dados

1. Inventariar somente campos vistos ou requeridos por decisão aprovada.
2. Para cada campo, registrar significado, tipo, cardinalidade, unidade, fonte, dono,
   instante, validade, confiança, acesso e possibilidade de correção.
3. Definir separadamente ausente, desconhecido, não aplicável, recusado e conflitante.
4. Ligar cada campo à decisão que ele sustenta; remover campos sem finalidade.

**Saída:** E6 e contrato da unidade `Paciente → Solicitação → Caso`.

## Passo 7 · Auditar procedimentos, protocolos e regras

1. Identificar o catálogo real de procedimentos e suas chaves.
2. Recolher protocolos institucionais aplicáveis, com dono clínico e vigência.
3. Mapear condições específicas como composição versionada de perguntas e regras.
4. Determinar quais dados são fatos, quais regras apenas sinalizam e quais decisões
   exigem revisão humana.
5. Avaliar CID, medicamentos, MET e widgets existentes contra o contrato, sem presumir
   cobertura.

**Saída:** E7 e insumos para G5/G7. Regra sem fonte local, dono e versão continua fora do
build.

## Passo 8 · Fechar agenda e capacidade

1. Determinar se o Antessala qualifica, mantém agenda de demo ou integra com agenda real.
2. Registrar agendas, recursos, locais, profissionais, modalidades, turnos e tipos de
   vaga existentes.
3. Registrar durações, restrições, bloqueios, encaixe, overbooking, remarcação,
   cancelamento e concorrência somente quando comprovados.
4. Definir a resposta quando nenhuma capacidade compatível existe.

**Saída:** E8 e escolha justificada entre A, B ou C do Build. A biblioteca visual não é
escolhida neste passo.

## Passo 9 · Definir fixtures e oráculos

1. Criar casos inteiramente sintéticos a partir do contrato, sem copiar combinações
   reconhecíveis de pacientes reais.
2. Cobrir ausência, conflito, mudança de procedimento, necessidades diferentes e falta
   de capacidade.
3. Para cada caso, registrar a entrada, o eixo alterado e o resultado verificável.
4. Marcar separadamente fato institucional, regra aprovada, valor sintético e mock.

**Saída:** E9 como especificação documental; não implementar fixture no runtime.

## Passo 10 · Mapear migração e baseline

1. Inventariar tabelas, tipos, handlers, rotas, textos e branches ligados ao produto
   invalidado.
2. Classificar cada item como manter, adaptar, migrar, desativar ou remover, com
   consumidor, risco e rollback.
3. Recolher baseline do ambulatório com definição e período, ou declarar
   indisponibilidade.
4. Definir critérios determinísticos da demo quando não houver baseline.

**Saída:** E10 e E11. Prova histórica de outro fluxo não pode preencher o baseline.

## Passo 11 · Consolidar e pedir o veredito

1. Atualizar o Analyst com decisões, contratos e estado de G1–G8.
2. Acrescentar ao Warlog fontes, divergências, bloqueios e racional; não apagar entradas.
3. Conferir cada critério de aceite desta minispec e a rastreabilidade das evidências.
4. Solicitar ao Analyst `PASS MINISPEC 001` ou lista nominal de bloqueios.

Se o veredito não for `PASS`, **PARAR**. Não iniciar a MiniSpec 002, não escrever código
de produto e não reinterpretar silêncio como aprovação.
