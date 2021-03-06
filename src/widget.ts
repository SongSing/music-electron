import { createElement } from "./util";
import { EventClass } from "./eventclass";

export class Widget extends EventClass
{
    public container : HTMLElement;
    protected contentContainer : HTMLElement;

    constructor(className_or_container? : string | HTMLElement)
    {
        super();
        
        if (className_or_container)
        {
            if (typeof(className_or_container) === "string")
            {
                this.container = createElement("div", className_or_container);
            }
            else
            {
                this.container = className_or_container;
            }
        }
        else
        {
            this.container = createElement("div");
        }

        this.contentContainer = this.container;
    }

    public show() : void
    {
        this.container.style.display = "";
    }

    public hide() : void
    {
        this.container.style.display = "none";
    }

    public appendChild(...children : (Node | Widget)[]) : void
    {
        if (children.length === 1)
        {
            this.appendHelper(this.contentContainer, children[0]);
        }
        else
        {
            let frag = document.createDocumentFragment();
    
            children.forEach(child =>
            {
                this.appendHelper(frag, child);
            });
    
            this.contentContainer.appendChild(frag);
        }
    }

    private appendHelper(parent : Node, child : (Node | Widget)) : void
    {
        if (child instanceof Node)
        {
            parent.appendChild(child);
        }
        else
        {
            parent.appendChild(child.container);
        }
    }

    public appendHTML(html : string) : void
    {
        this.contentContainer.innerHTML += html;
    }

    public removeChild(child : HTMLElement | Widget) : boolean
    {
        if (!this.hasChild(child))
        {
            return false;
        }

        if (child instanceof HTMLElement)
        {
            this.contentContainer.removeChild(child);
        }
        else
        {
            this.contentContainer.removeChild(child.container);
        }

        return true;
    }

    public hasChild(child : HTMLElement | Widget)
    {
        if (child instanceof HTMLElement)
        {
            return this.contentContainer.contains(child);
        }
        else
        {
            return this.contentContainer.contains(child.container);
        }
    }
}