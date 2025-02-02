
import { RpgCommonMap } from '@rpgjs/common'
import { World } from '@rpgjs/sync-server'
import { EventMode } from '../Event';
import { RpgMap } from '../Game/Map';

export class SceneMap {

    static readonly id: string = 'map'

    private mapsById: object = {}
    
    constructor(private maps: any[], private server: any) {
        this.mapsById = {}
        if (this.maps) {
            for (let map of this.maps) {
                this.mapsById[map.id] = map
            }
        }
    }

    getMapBydId(id) {
        const mapClass = this.mapsById[id]
        if (!mapClass) {
            console.log(`Map ${id} not exists`)
            return false
        }
        return mapClass
    }

    async loadMap(id: string): Promise<RpgMap> {
        const mapClass = this.getMapBydId(id)
        let mapInstance
        
        if (mapClass.buffer.has(id)) {
            return mapClass.buffer.get(id)
        }

        if (RpgCommonMap.buffer.has(id)) {
            mapInstance =  RpgCommonMap.buffer.get(id)
        }
        else {
            mapInstance = World.addRoom(id, new mapClass(this.server))
            await mapInstance.load()
        }
       
        return mapInstance
    }

    async changeMap(mapId, player, positions?): Promise<RpgMap> {
        
        player.prevMap = player.map
        player.map = mapId
        player.events = []

        if (player.prevMap) {
            World.leaveRoom(player.prevMap, player.id)
            player.execMethod('onLeave', [player], player.mapInstance)
            player.execMethod('onLeaveMap', [player.mapInstance])
        }

        const mapInstance = await this.loadMap(mapId)

        if (!player.height) player.height = mapInstance.tileHeight
        if (!player.width) player.width = mapInstance.tileWidth
        if (!player.hitbox.h) player.hitbox.h = mapInstance.tileHeight
        if (!player.hitbox.w) player.hitbox.w = mapInstance.tileWidth

        let { data: serializeMap } = Object.assign({}, RpgCommonMap.buffer.get(mapId))
        delete serializeMap.shapes 
        delete serializeMap.events
        delete serializeMap._events

        for (let layer of serializeMap.layers) {
            delete layer.map
        }

        player.loadScene('map', {
            id: mapId,
            sounds: mapInstance.sounds,
            ...serializeMap
        })

        World.joinRoom(mapId, player.id)

        player = World.getUser(player.id)
        
        player.execMethod('onEnter', [player, player.prevMap || null], mapInstance)
        player.execMethod('onJoinMap', [mapInstance])

        player.teleport(positions || 'start')
        player.events = mapInstance.createEvents(mapInstance._events, EventMode.Scenario)
        for (let key in player.events) {
            player.events[key].execMethod('onInit', [player])
        }
        return mapInstance
    }
}