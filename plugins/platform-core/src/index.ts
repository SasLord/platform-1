//
// Copyright © 2020 Andrey Platov <andrey.v.platov@gmail.com>
// 
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

import { KeysByType } from 'simplytyped'

import { PropType, AsString, Metadata, identify, Plugin, PluginId } from '@anticrm/platform'

export type AnyFunc = (...args: any[]) => any
export type Ref<T extends Doc> = AsString<T> & { __ref: void }

export type PropertyType = PropType<any> | Embedded | { [key: string]: PropertyType } | PropertyType[] | string

export type Bag<X extends PropertyType> = { [key: string]: X }

export class SessionProto {
  getSession(): CorePlugin { throw new Error('detached object') }
}

export abstract class Obj extends SessionProto {
  _class: Ref<Class<this>>
  protected constructor(_class: Ref<Class<Obj>>) {
    super()
    this._class = _class as Ref<Class<this>>
  }
  getClass(this: Obj): Class<this> {
    return this.getSession().getInstance(this._class) as Class<this>
  }
  toIntlString(plural?: number): string {
    return this.getClass().toIntlString(plural)
  }
}

export abstract class Doc extends Obj {
  _id: Ref<this>
  _mixins?: string[]
  protected constructor(_class: Ref<Class<Doc>>, _id: Ref<Doc>) {
    super(_class)
    this._id = _id as Ref<this>
  }
}

// T Y P E S

export abstract class Embedded extends Obj {
  // __embedded!: void
}

export class Type<T extends PropertyType> extends Embedded {
  _default?: T
  constructor(_class: Ref<Class<Type<T>>>, _default?: T) {
    super(_class)
    this._default = _default
  }
  exert(value: T): any { return value ?? this._default }
  hibernate(value: any): T { return value }
}
export type AnyType = Type<PropertyType>

export class RefTo<T extends Doc> extends Type<Ref<T>> {
  to: Ref<Class<T>>
  constructor(to: Ref<Class<T>>, _default?: Ref<T>) {
    super(core.class.RefTo as Ref<Class<RefTo<T>>>, _default)
    this.to = to
  }
}

export class InstanceOf<T extends Embedded> extends Type<T> {
  of: Ref<Class<T>>
  constructor(of: Ref<Class<T>>, _default?: T) {
    super(core.class.InstanceOf as Ref<Class<InstanceOf<T>>>, _default)
    this.of = of
  }
  exert(value: T) {
    return this.getSession().instantiate(value)
  }
}

// C O L L E C T I O N S : A R R A Y

class ArrayProxyHandler implements ProxyHandler<PropertyType[]> {
  private type: Type<PropertyType>

  constructor(type: Type<PropertyType>) {
    this.type = type
  }

  get(target: PropertyType[], key: PropertyKey): any {
    const value = Reflect.get(target, key)
    return this.type.exert(value)
  }
}

export class ArrayOf<T extends PropertyType> extends Type<T[]> {
  of: Type<T>
  constructor(of: Type<T>, _default?: T[]) {
    super(core.class.ArrayOf as Ref<Class<ArrayOf<T>>>, _default)
    this.of = of
  }
  exert(value: T[]) {
    return new Proxy(value, new ArrayProxyHandler(this.of))
  }
}

// C O L L E C T I O N S : B A G

class BagProxyHandler implements ProxyHandler<Bag<PropertyType>> {
  private type: Type<PropertyType>

  constructor(type: Type<PropertyType>) {
    this.type = type
  }

  get(target: Bag<PropertyType>, key: string): any {
    const value = Reflect.get(target, key)
    return this.type.exert(value)
  }
}

export class BagOf<T extends PropertyType> extends Type<Bag<T>> {
  of: Type<T>
  constructor(of: Type<T>, _default?: Bag<T>) {
    super(core.class.BagOf as Ref<Class<BagOf<T>>>, _default)
    this.of = of
  }
  exert(value: Bag<T>) {
    return new Proxy(value, new BagProxyHandler(this.of))
  }
}

// C L A S S E S  &  M I X I N S

export class Class<T extends Obj> extends Doc {
  attributes: Bag<Type<PropertyType>>
  extends?: Ref<Class<Obj>>
  native?: Metadata<T>
  constructor(_class: Ref<Class<Class<T>>>, _id: Ref<Class<T>>, attributes: Bag<Type<PropertyType>>, _extends: Ref<Class<Obj>>, native?: Metadata<T>) {
    super(_class, _id)
    this.attributes = attributes
    this.extends = _extends
    this.native = native
  }
  toIntlString(plural?: number): string { return 'Класс' }
}

export interface Mixin<T extends Doc> extends Class<T> { }

// C O R E  P L U G I N

export type Query<T extends Doc> = Partial<T>

export type RemoveMethods<T extends object> = Omit<T, KeysByType<T, AnyFunc>>
export type Content<T extends Doc> = RemoveMethods<Omit<T, '_id' | '_class' | '__embedded'>> & { _id?: Ref<T> }

export interface CorePlugin extends Plugin {
  getInstance<T extends Doc>(ref: Ref<T>): T
  newInstance<T extends Obj>(clazz: Ref<Class<T>>): T
  instantiate<T extends Obj>(obj: T): T

  find<T extends Doc>(clazz: Ref<Class<T>>, query: Query<T>): T[]
  findOne<T extends Doc>(clazz: Ref<Class<T>>, query: Query<T>): T | undefined

  loadModel(docs: Doc[]): void
  // mixin<T extends Doc, E extends T>(doc: Ref<T>, mixin: Ref<Mixin<E>>): E
}

export const pluginId = 'core' as PluginId<CorePlugin>

const core = identify(pluginId, {
  native: {
    Object: '' as Metadata<Obj>,
    Type: '' as Metadata<Type<PropertyType>>,
    RefTo: '' as Metadata<RefTo<Doc>>,
    BagOf: '' as Metadata<BagOf<PropertyType>>,
    ArrayOf: '' as Metadata<ArrayOf<PropertyType>>,
    InstanceOf: '' as Metadata<InstanceOf<Embedded>>,
  },
  class: {
    RefTo: '' as Ref<Class<RefTo<Doc>>>,
    BagOf: '' as Ref<Class<BagOf<PropertyType>>>,
    ArrayOf: '' as Ref<Class<ArrayOf<PropertyType>>>,
    InstanceOf: '' as Ref<Class<InstanceOf<Embedded>>>,
  },
})

export default core