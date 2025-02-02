import { RpgCommonMap, RpgPlugin, HookClient } from '@rpgjs/common'
import TileMap from '../Tilemap'
import { Viewport } from 'pixi-viewport'
import { IScene } from '../Interfaces/Scene'
import { Scene } from './Scene'
import { spritesheets } from '../Sprite/Spritesheets'
import Character from '../Sprite/Character'
import { RpgSound } from '../Sound/RpgSound'

export class SceneMap extends Scene implements IScene {

    /** 
     * Get the tilemap
     * 
     * @prop {TileMap} [tilemap]
     * @memberof RpgSceneMap
     * */
    public tilemap: TileMap

    /** 
     * The viewport of the map
     * 
     * It automatically follows the sprite representing the player but you can attach it to something else
     * 
     * > Do not change the size of the viewport
     * 
     * @prop {PIXI.Viewport} viewport
     * @memberof RpgSceneMap
     * */
    protected viewport: Viewport | undefined
    private players: object = {}
    private isLoaded: boolean = false
    private gameMap: RpgCommonMap

    constructor(
            protected game: any, 
            private options: { screenWidth?: number, screenHeight?: number } = {}) {
        super(game)
        this.onInit()
    }

    load(obj): Promise<Viewport> {
        this.gameMap = new RpgCommonMap()
        this.gameMap.load(obj)

        if (!this.game.standalone) RpgCommonMap.buffer.set(obj.id, this.gameMap)

        this.tilemap = new TileMap(obj, this.game.renderer)

        const loader = PIXI.Loader.shared
        let nbLoad = 0

        loader.reset()

        for (let tileset of this.tilemap.tileSets) {
            if (tileset.spritesheet.resource) continue
            loader.add(tileset.name, tileset.spritesheet.image)
            nbLoad++
        }

        loader.load((loader, resources) => {
            for (let tileset of this.tilemap.tileSets) {
                const spritesheet = spritesheets.get(tileset.name)
                if (resources[tileset.name]) spritesheet.resource = resources[tileset.name]  
            }
        })

        RpgSound.global.stop()

        RpgPlugin.emit(HookClient.SceneMapLoading, loader)

        return new Promise((resolve, reject) => {
            const complete = () => {
                this.tilemap.load()
                this.viewport = new Viewport({
                    screenWidth: this.options.screenWidth,
                    screenHeight: this.options.screenHeight,
                    worldWidth: obj.width * obj.tileWidth,
                    worldHeight: obj.height * obj.tileHeight
                })
                this.tilemap.addChild(this.animationLayer)
                this.viewport.clamp({ direction: 'all' })
                this.viewport.addChild(this.tilemap)
                this.isLoaded = true
                if (obj.sounds) {
                    obj.sounds.forEach(soundId => RpgSound.get(soundId).play())
                }
                resolve(this.viewport)
                if  (this.onLoad) this.onLoad()
            }
            loader.onError.add(() => {
                reject()
            })
            loader.onComplete.add(complete)
            if (nbLoad == 0) {
                complete()
            }
        })
    }

    draw(t: number, dt: number, frame: number) {
        if (!this.isLoaded) {
            return
        }
        super.draw(t, dt, frame)
        this.tilemap.drawAnimateTile(frame)
    }

    onUpdateObject(logic, sprite: Character, moving: boolean): Character {
        const { paramsChanged } = logic
        if (moving || (paramsChanged && (paramsChanged.width || paramsChanged.height))) {
            const { tileWidth, tileHeight } = this.gameMap
            const { tilesOverlay }: any = sprite
            const bounds = sprite.parent.getLocalBounds()
            const width = Math.ceil(bounds.width / tileWidth) * tileWidth
            const height = Math.ceil(bounds.height / tileHeight) * tileHeight
            const _x = bounds.x
            const _y = bounds.y

            const addTile = (x, y) => {
                const tiles = this.tilemap.createOverlayTiles(x, y, sprite)
                if (tiles.length) tilesOverlay.addChild(...tiles)
            }

            tilesOverlay.removeChildren()

            for (let i = _x ; i <= _x + width ; i += tileWidth) {
                for (let j = _y ; j <= _y + height ; j += tileHeight) {
                    addTile(i, j)
                }
            }
        }
        return sprite
    }

    setPlayerPosition(id: string, { x, y }: { x: number, y: number }) {
        this.players[id].x = x
        this.players[id].y = y
    }

    updateScene(obj) {
        const shapes = obj.partial.shapes
        if (shapes) {
            const shapesInMap = this.gameMap.getShapes()
            for (let name in shapes) {
                const shapeMap = shapesInMap[name]
                let shape = shapes[name]
                if (shape == null) {
                    this.gameMap.removeShape(name)
                    continue
                }
                shape = {
                    ...shape,
                    x: shape.hitbox.pos.x,
                    y: shape.hitbox.pos.y,
                    width: shape.hitbox.w,
                    height: shape.hitbox.h,
                    properties: {}
                }
                if (shapesInMap[name]) {
                    shapeMap.set(shape)
                }
                else {
                    this.gameMap.createShape(shape)
                }
            }
        }
    }

    addObject(obj, id: string): Character {
        const wrapper = new PIXI.Container()
        const inner = new PIXI.Container()
        const tilesOverlay = new PIXI.Container()
        const sprite = new this.game._playerClass(obj, this)
        
        sprite.tilesOverlay = tilesOverlay
        inner.addChild(sprite)
        wrapper.addChild(inner, tilesOverlay)

        this.objects.set(id, sprite)
        this.tilemap.getEventLayer().addChild(wrapper)

        if (sprite.isCurrentPlayer) this.viewport?.follow(sprite)
        sprite.onInit()

        RpgPlugin.emit(HookClient.SceneAddSprite, [this, sprite], true)
        RpgPlugin.emit(HookClient.AddSprite, sprite)
        return sprite
    }

    removeObject(id: string) {
        let sprite =  this.objects.get(id)
        if (sprite) {
            this.objects.delete(id)
            RpgPlugin.emit(HookClient.SceneRemoveSprite, [this, sprite], true)
            RpgPlugin.emit(HookClient.RemoveSprite, sprite)
            sprite.destroy()
        }
    }
}