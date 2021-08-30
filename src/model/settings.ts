import { ReadOnlyReference, Reference } from "model/ref";
import { AbstractTextComponent, Setting } from "obsidian";
import { Later, parseLaters, Time } from "model/time";

export class SettingModelBuilder {
    _key: string;
    _name: string;
    _desc: string;

    key(key: string) {
        this._key = key;
        return this;
    }

    name(name: string) {
        this._name = name;
        return this;
    }

    desc(desc: string) {
        this._desc = desc;
        return this;
    }

    static builder(): SettingModelBuilder {
        return new SettingModelBuilder();
    }

    text(initValue: string) {
        return new TextSettingModelBuilder(this, false, initValue);
    }

    textArea(initValue: string) {
        return new TextSettingModelBuilder(this, true, initValue);
    }

    toggle(initValue: boolean) {
        return new ToggleSettingModelBuilder(this, initValue);
    }
}

interface Serde<R, E> {
    unmarshal(rawValue: R): E
    marshal(value: E): R
}

abstract class AbstractSettingModelBuilder<R> {

    constructor(protected baseBuilder: SettingModelBuilder, protected initValue: R) { };

    abstract build<E>(serde: Serde<R, E>): SettingModel<R, E>;

}

class TextSettingModelBuilder extends AbstractSettingModelBuilder<string>{

    private _placeHolder: string;

    constructor(base: SettingModelBuilder, private longText: boolean, initValue: string) {
        super(base, initValue);
    }

    placeHolder(placeHolder: string) {
        this._placeHolder = placeHolder;
        return this;
    }

    build<E>(serde: Serde<string, E>): SettingModel<string, E> {
        return new SettingModelImpl(this.baseBuilder._key, this.baseBuilder._name, this.baseBuilder._desc, serde, this.initValue, (setting, rawValue) => {
            const initText = (text: AbstractTextComponent<any>) => {
                text
                    .setPlaceholder(this._placeHolder)
                    .setValue(rawValue.value)
                    .onChange(async (value) => {
                        try {
                            serde.unmarshal(value);
                            rawValue.value = value;
                        } catch (e) {
                            console.log("invalid value: value=%s, exception=%s", value, e);
                        }
                    })
            }
            if (this.longText) {
                setting.addTextArea((textarea) => {
                    initText(textarea);
                })
            } else {
                setting.addText((text) => {
                    initText(text);
                })
            }
        });
    }
}

class ToggleSettingModelBuilder extends AbstractSettingModelBuilder<boolean>{

    build<E>(serde: Serde<boolean, E>): SettingModel<boolean, E> {
        return new SettingModelImpl(this.baseBuilder._key, this.baseBuilder._name, this.baseBuilder._desc, serde, this.initValue, (setting, rawValue) => {
            setting.addToggle((toggle) =>
                toggle
                    .setValue(rawValue.value)
                    .onChange(async (value) => {
                        rawValue.value = value;
                    })
            );
        })
    }

}

export interface SettingModel<R, E> extends ReadOnlyReference<E> {

    rawValue: Reference<R>;

    createSetting(containerEl: HTMLElement): Setting;

    load(settings: any): void;

    store(settings: any): void;

}

class SettingModelImpl<R, E> implements SettingModel<R, E>{

    rawValue: Reference<R>;

    constructor(private key: string, private name: string, private desc: string, private serde: Serde<R, E>, initRawValue: R, private settingInitializer: (setting: Setting, rawValue: Reference<R>) => void) {
        this.rawValue = new Reference(initRawValue);
    }

    createSetting(containerEl: HTMLElement): Setting {
        const setting = new Setting(containerEl)
            .setName(this.name)
            .setDesc(this.desc);
        this.settingInitializer(setting, this.rawValue);
        return setting;
    }

    get value(): E {
        return this.serde.unmarshal(this.rawValue.value);
    }

    load(settings: any): void {
        if (settings === undefined) {
            return;
        }
        const newValue = settings[this.key];
        if (newValue !== undefined) {
            this.rawValue.value = newValue;
        }
    }

    store(settings: any): void {
        settings[this.key] = this.rawValue.value;
    }
}

export class TimeSerde implements Serde<string, Time>{
    unmarshal(rawValue: string): Time {
        return Time.parse(rawValue);
    }
    marshal(value: Time): string {
        return value.toString();
    }
}

export class RawSerde<R> implements Serde<R, R>{
    unmarshal(rawValue: R): R {
        return rawValue;
    }
    marshal(value: R): R {
        return value;
    }
}

export class LatersSerde implements Serde<string, Array<Later>>{
    unmarshal(rawValue: string): Later[] {
        return parseLaters(rawValue);
    }
    marshal(value: Later[]): string {
        return value.map(v => v.label).join("\n");
    }
}
