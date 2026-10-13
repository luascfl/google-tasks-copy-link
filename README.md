# google-tasks-copy-link

Userscript que adiciona o item **Copiar link** ao menu de opções (três pontos) de cada tarefa no Google Tarefas embutido no Gmail:

`https://tasks.google.com/embed/list/~default?origin=https%3A%2F%2Fmail.google.com`

O item aparece entre "Adicionar anexo" e "Excluir". Ao clicar, copia `https://tasks.google.com/tasks/?sa=6&taskId=<id>` para a área de transferência, mostra o aviso "Link copiado" e fecha o menu. Esse link abre a tarefa no Google Tarefas completo.

## Do link completo para o embed

O embed ignora `taskId` por conta própria. O script lê `taskId` da URL do embed, rola até a tarefa e a destaca por 3 segundos. Para converter um link completo, troque `https://tasks.google.com/tasks/?sa=6&taskId=<id>` por:

`https://tasks.google.com/embed/list/~default?origin=https%3A%2F%2Fmail.google.com&taskId=<id>`

Só funciona se a tarefa estiver na lista aberta (Minhas tarefas, por padrão).

## Instalação

Instale `google-tasks-copy-link.user.js` no Tampermonkey. O script usa `GM_setClipboard`, então não depende da permissão de área de transferência do iframe do Gmail.

## Como funciona

- Um listener em fase de captura registra a tarefa (`data-id` da linha) quando o botão "Opções" ou o clique direito é acionado.
- Um `MutationObserver` insere o item quando o menu da tarefa aparece. O menu de opções da lista, que não vem de uma tarefa, não recebe o item.
- O item clona um item nativo do menu e remove os atributos `jsaction`, `jsname` e `jslog`, então herda o visual e o framework do Google o ignora.

## Limitações

- Os seletores (`jsname="pzCKEc"`, `.JAPqpe`, `[role="listitem"][data-type="0"]`) vêm do HTML atual do Google e podem mudar.
- Só vale para `https://tasks.google.com/embed/list/*`.
