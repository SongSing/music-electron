import { array_remove, array_ensureOne } from "./util";

export class EventClass
{
    private events : Map<string, Function[]> = new Map<string, Function[]>();

    constructor()
    {
        // poopie
    }

    protected createEvent(event : string)
    {
        if (!this.events.has(event))
        {
            this.events.set(event, []);
        }
    }

    protected emitEvent(event : string, ...args : any[]) : void
    {
        if (!this.events.has(event))
        {
            throw "no such event: " + event;
        }
        
        this.events.get(event).forEach(fn => fn(...args));
    }

    public on(event : string, fn : Function)
    {
        if (!this.events.has(event))
        {
            throw "no such event: " + event;
        }

        if (array_ensureOne(this.events.get(event), fn).existed)
        {
            console.warn("duplicate function on event: " + event);
        }
    }

    public once(event : string, fn : Function)
    {
        let wrapperFn = () =>
        {
            fn();
            array_remove(this.events.get(event), wrapperFn);
        };

        this.on(event, wrapperFn);
    }
}