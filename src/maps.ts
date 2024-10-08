import { v4 as uuidv4 } from 'uuid';
import { ByteBuffer } from "./lib/bytebuffer";
import { QueueBuffer } from "./lib/queuebuffer";
import * as packets from './packets';
import { characters } from './interfaces/characters.interface';
import { updateCharacterInfo, updateCharacterMapId } from './DB/db.connect';
import * as inventario from './inventario'

class Mapa {
    public id: string;
    public namespace: string; // Nome único do mapa
    public entities: Map<string, any>; // Armazena entidades (jogadores e NPCs)
    private gatherables: any; // Adicione o tipo apropriado
    private npcs: any; // Adicione o tipo apropriado
    private respawns: any; // Adicione o tipo apropriado
    private tickInterval: NodeJS.Timeout | null = null; // Timer para ticks

    constructor(namespace: string, options?: { gatherables?: any; npcs?: any; respawns?: any }) {
        this.id = uuidv4(); // ID único para o mapa
        this.namespace = namespace;
        this.entities = new Map<string, any>(); // Entidades no mapa (jogadores, NPCs)
        this.gatherables = options?.gatherables || [];
        this.npcs = options?.npcs || [];
        this.respawns = options?.respawns || [];
        // Inicia o intervalo de ticks
        this.startTick()
    }

    // Adiciona um jogador no mapa
    addPlayer(clientId: string, socket: any) {
        this.entities.set(clientId, socket);
       // console.log(`Player ${character.nome} entrou no mapa ${this.namespace}`);
       this.broadcast(packets.spawnproxy(socket.character.name,socket.character.characterinfo),socket.character.name);
        //console.log('entities:',this.entities);
       // console.log('clients:',this.clients);
    }

    // Remove um jogador do mapa
    removePlayer(clientId: string, socket:any) {
        this.entities.delete(clientId); // Remove a entidade do jogador
        this.broadcast(packets.removecharacter(socket.character.name),socket.id);
       // console.log(`Player ${clientId} saiu do mapa ${this.namespace}`);
    }

    // Envia uma mensagem (pacote) a todos os jogadores no mapa
    broadcast(message: ByteBuffer, exceptId: string) {
        
        this.entities.forEach((character, clientId) => {
            if (clientId !== exceptId) { // Não enviar para o jogador de origem
               // console.log('excepted',{exceptId},{clientId});
               character.send(message.getBuffer());
            }else
              //console.log('cliet',{clientId});
              ;
        });
        
    }


    // Atualiza a posição de um jogador no mapa e faz broadcast para os outros
    movePlayer(clientId: string, x: number, y: number, z: number, xr: number, yr: number, zr: number, velocity: string,socket:any) {
        //console.log('clientid:',clientId)
        const character = this.entities.get(clientId);
        const velocityString: string = velocity; // Exemplo de string de velocity
        const velocityArray: string[] = velocityString.split(","); // Divide a string por vírgula
        
        if (velocityArray.length === 3) { // Verifica se obteve três valores
            const vx: number = parseFloat(velocityArray[0]); // Converte o primeiro valor em número
            const vy: number = parseFloat(velocityArray[1]); // Converte o segundo valor em número
            const vz: number = parseFloat(velocityArray[2]); // Converte o terceiro valor em número
       
        
        if (character) {

            socket.character.gameplayVariables.transform.x = x; // Define a nova posição x
            socket.character.gameplayVariables.transform.y = y; // Define a nova posição y
            socket.character.gameplayVariables.transform.z = z; // Define a nova posição z
    
            // Converte o objeto de volta para uma string JSON
            const newCharacterInfo = JSON.stringify(socket.character);
            
            updateCharacterInfo(socket.characterId, newCharacterInfo, (success) => {
                if (success) {
                    //console.log(characterData); // Agora, este é um objeto válido
                   // console.log(socket.characterId,newCharacterInfo);
                } else {
                    console.log(`Failed to update character info.`);
                }
            });
            
          // console.log(`Player ${character.nome} moved to (${x}, ${y}, ${z},${vx}, ${vy}, ${vz})`);
    
            // Faz broadcast para os outros jogadores no mapa
            this.broadcast(packets.packetMove(clientId, { x, y, z, xr, yr, zr },vx,vy,vz), socket.character.name.toString());
        }
    }
        
    }

    // Função para transportar um jogador de um mapa para outro
    transportPlayer(newMap: Mapa, newPosX: string, newPosY: string, newPosZ: string,mapaid:string,socket:any) {
        const character = this.entities.get(socket.character.name);  // Obtém o personagem pelo clientId
    
        if (character) {
            // Remover o jogador do mapa atual
            this.removePlayer(socket.character.name,socket);                       
    
            // Atualizar a posição do jogador
            socket.character.gameplayVariables.transform.x = newPosX; // Define a nova posição x
            socket.character.gameplayVariables.transform.y = newPosY; // Define a nova posição y
            socket.character.gameplayVariables.transform.z = newPosZ; // Define a nova posição z
            socket.character.gameplayVariables.atualMap = mapaid;
        
            // Converte de volta para string JSON
            const newCharacterInfo = JSON.stringify(socket.character);
    
            // Atualizar o characterInfo no objeto `character`
            character.characterinfo = newCharacterInfo;
    
            // Atualiza as informações no banco de dados
            updateCharacterInfo(character.id, newCharacterInfo, (success) => {
                if (success) {
                    console.log(`Player ${socket.character.name} foi transportado para o mapa ${newMap.namespace}.`);
                    
                    // Adicionar o jogador ao novo mapa
                    newMap.addPlayer(socket.character.name, socket,);
                    
                    // Atualizar o ID do mapa no banco de dados, certifique-se de passar o ID correto
                    updateCharacterMapId(character.id, mapaid, (updateSuccess) => {
                        if (updateSuccess) {
                           // console.log(`Mapa do jogador atualizado no banco de dados para ${newMap.namespace}`);
                        } else {
                            console.error('Erro ao atualizar o ID do mapa no banco de dados');
                        }
                    });
                    
                    // Fazer broadcast para os outros jogadores no novo mapa
                    
                } else {
                    console.log(`Falha ao atualizar informações do personagem.`);
                }
            });
            
        } else {
            console.error(`Personagem não encontrado para o clientId: ${socket.character.name}`);
        }
    }
    
    coletaritem(socket: any){
                
        inventario.adicionaraoinventario("10002", 1, socket.conteinerids, `{
            "itemName": "Sword of Valor",
            "durability": 100,
            "rarity": "Rare",
            "weight": 2.5,
            "description": "A legendary sword imbued with magical power."
        }`,socket);
    }
    
    


    // Retorna uma lista de jogadores presentes no mapa
    getPlayers() {
        return Array.from(this.entities.values());
    }

    private startTick() {
        this.tickInterval = setInterval(() => {
            this.onTick();
        }, 200); // 200 milliseconds = 0.2 seconds
    }
    // Função para processar eventos periódicos (ticks)
    onTick() {
        // Aqui você pode adicionar lógica para NPCs ou eventos periódicos no mapa
        //console.log(`Mapa ${this.namespace} processando tick...`);
        // Exemplo: Atualizar estados dos personagens ou verificar respawns
      //console.log(this.namespace,this.getPlayers())
    }
}

export { Mapa };
