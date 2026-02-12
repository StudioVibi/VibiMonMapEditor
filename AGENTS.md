Editor Giga

Vamos criar um editor de mapa para o jogo VibiMon. VibiMon é um Battle Royale competitivo com visuais e mecânicas fiéis ao do Game Boy original e do jogo Pokémon Red 1st Gen.

O objetivo desse editor de mapa é criar mapas com sprites, eventos, etc, de forma visual mas ao mesmo tempo raw.  < na vdd é o contrário disso

Vamos usar ts com html, quero o editor de forma mais crua possível mas ainda sim bonito e responsivo.

O editor de level na verdade é um editor de glifos, definido no projeto principal VibiMon, onde cada tile é feito de 8 caracteres. o diretório do VibiMon está clonado nesse projeto para fins de referência. (Highlight para os arquivos glyph.ts e world_map.ts)

#Layout

A tela é dividida em 3 sessões. Topo (infos e navegação), Esquerda (barra lateral ferramentas), e Direita (grid/glifos???)

A sessão do topo é tipo uma navbar, que vai conter o nome do projeto no canto superior esquerdo. Coloca ela fina tipo 10% da altura total do site. Na direita dessa navbar um toggle RAW | VISUAL que vai alterar a renderização da grid.

A sessão da esquerda tem 1/3 da largura da tela e vai ser responsável por mostrar todas as “ferramentas” disponíveis

A sessão da direita tem 2/3 da largura, preenchendo todo restante da tela com a grid/tile de glifos.

Exemplo da estrutura:
———————————
|           |                        |
———————————
|           |                        |
|           |                        |
|           |                        |
———————————

#Editor

O editor vai ser feito seguindo a base e estrutura do editor de glifos como mencionado anteriormente. Mas vamos ter dois modos de visualização: Raw e Visual.

O raw nada mais é do que a estrutura exata dos da grid de glifos que já existe.

O visual “transforma” os glifos em uma grid de tiles mesmo, com sprites

Embora visualizações são completamente diferentes, elas precisam sempre estar alinhadas, pra poder 

#Ferramentas

!!! Ta faltando explicar melhor sobre as duas viewports, existem comportamentos especificados de cada uma que não tá sendo comentado aqui

Pra v0 vamos ter 2 sessões de ferramentas e 3 ferramentas no total.

## Move Tool Section
### Ferramenta Move
Move a posição de um ou mais tiles pela grid. 

Para mover um tile: seleciona a ferramenta Move > clica no tile > arrasta para a nova posição na grid

Para mover mais de um tile: seleciona a ferramenta de move > clica na grid e arrasta para criar uma área de seleção > apenas os tiles cobertos *completamente* nessa área de seleção podem ser motivos para outras posições na grid.

## Sprites Tool Section
###Ferramenta Paint

Diferente das outras ferramentas, quando a ferramenta Paint é selecionada, uma área com informações aparece na barra de ferramentas, logo abaixo:

Essa área tem um componente que acessa os glifos existentes e exibe na interface como se fossem “tiles sets”.

Exemplo: um dos tiles disponível é o Green Tree, onde o ID é TT e representa o sprite de uma árvore, seria apresentado na interface dessa forma:

🌴 TT Green Tree
🐰 BN Cute Bunny (fictional, just for the example)

🌴 TT Green Tree > (ícone/sprite - ID/Gliphy code - Nome do sprite

————
|            |
|            |
> paint
|  v - lista os “tiles sets” existentes
|            | 
————

Como pintar: 
1. manualmente: seleciona o sprite desejado na lista > clique em um tile na grid
2. múltiplos: seleciona o sprite desejado na lista > clique e arraste em outros tiles para selecionar

### Ferramenta Rubber
Apaga/remove as informações do tile completamente e volta para o caractere “vazio” da grid.

Para apagar um tile da grid: selecionar a ferramenta rubber > clicar em um tile

Para apagar múltiplos: selecionar a ferramenta rubber > clicar e arrastar > soltar para selecionar uma área > APENAS os tiles cobertos *completamente* podem ser deletados 

A ferramenta move é a padrão que sempre começa selecionada.

Os assets/svgs/ícones desse editor estão disponíveis na pasta icons.

#Output

O output de tudo isso é extremamente simples, e a própria grid RAW me fornece isso: posso simplesmente arrastar o cursor e selecionar todo o texto e colar no código oficial já que ambas seguem a mesma configuração e estrutura de grid/tiles.

Nenhuma automatização ou integração com o projeto VibiMon será necessária durante a v0.




## Editor Raw

Segue a base de estrutura de editor de glifos


>>> editor VISUAL: Na área da grid quero comandos básicos dar zoom, scroll, navegar, etc. definir navegação 

Como é a V0, não quero nenhuma integração com o VibiMon, quando eu finalizar o level com todos elementos, eu posso simplesmente alterar o texto pela viewport “de baixo nível” RAW e depois colar no código oficial. Por isso é extremamente importante entender o projeto oficial (source) e garantir fidelidade na estrutura do Editor.

existam dois modos de uso RAW e VISUAL (default).

A viewport RAW, vai 
