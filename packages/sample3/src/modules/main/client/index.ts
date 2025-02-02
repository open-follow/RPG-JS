import { RpgClient, RpgModule, Spritesheet } from '@rpgjs/client'
import { sprite } from './sprite'

@RpgModule<RpgClient>({ 
    sprite
})
export default class RpgClientEngine {}