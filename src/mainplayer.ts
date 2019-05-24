import { Widget } from "./widget";
import { Playlist } from "./playlist";
import { Player } from "./player";
import { BottomBar } from "./bottombar";
import { Filter } from "./filter";
import { createElement, array_copy, array_contains, hideElement, showElement, array_last, element_scrollIntoViewIfNeeded, array_remove_all, revealInExplorer } from "./util";
import { Song } from "./song";
import { RenameRule } from "./renamerule";
import { ContextMenu, ContextMenuItem } from "./contextmenu";
import { RenameDialog } from "./renamedialog";
import { Spectrum } from "./spectrum";
import { PlaylistDialog } from "./playlistdialog";
import { InputDialog } from "./inputdialog";
import { PlaylistWidget } from "./playlistwidget";
import { PlaylistItemWidget } from "./playlistitemwidget";

export class MainPlayer extends Widget
{
    private filter : Filter;
    private playlistWidget : PlaylistWidget;
    private player : Player;
    private bottomBar : BottomBar;
    private songMenu : ContextMenu;
    private playlistMenu : ContextMenu;
    private removeFromPlaylistItem : ContextMenuItem;
    private renameDialog : RenameDialog;
    private playlistDialog : PlaylistDialog;
    private spectrum : Spectrum;

    private currentlyPlaying : PlaylistItemWidget;
    private songCountSwitch : boolean = false;

    private backgroundOverlay : HTMLElement;
    private backgroundPicture : HTMLElement;
    private loadingElement : HTMLImageElement;

    private skipOnceSongs : PlaylistItemWidget[] = [];

    constructor(container : HTMLElement)
    {
        super(container);

        this.filter = new Filter(createElement("div", "filter-container"));
        this.playlistWidget = new PlaylistWidget(createElement("div", "songList"));
        this.bottomBar = new BottomBar(createElement("div", "bottomPanel"));
        this.player = new Player(this.bottomBar.wavebar);
        this.spectrum = new Spectrum();

        this.renameDialog = new RenameDialog(((err : NodeJS.ErrnoException) =>
        {
            if (err)
            {
                window.alert(err);
                throw err;
            }

            this.renameDialog.hide();
        }).bind(this));

        this.songMenu = new ContextMenu();
        this.songMenu.addItem(new ContextMenuItem("Rename...", this.promptRename.bind(this)));
        this.songMenu.addItem(new ContextMenuItem("Edit rules...", this.editRules.bind(this)));
        this.songMenu.addItem(new ContextMenuItem("Reveal in explorer", this.revealInExplorer.bind(this)));
        this.songMenu.addItem(new ContextMenuItem("Skip once", this.skipSongOnce.bind(this)));

        this.playlistMenu = new ContextMenu();
        let playListItem = new ContextMenuItem("Add to playlist");
        playListItem.subMenu = this.playlistMenu;
        this.songMenu.addItem(playListItem);

        this.removeFromPlaylistItem = new ContextMenuItem("Remove from playlist", this.removeFromPlaylist.bind(this));
        this.songMenu.addItem(this.removeFromPlaylistItem);

        this.backgroundPicture = createElement("div", "albumArt");
        this.backgroundOverlay = createElement("div", "albumOverlay");

        this.loadingElement = <HTMLImageElement>createElement("img", "loading");
        this.loadingElement.src = "./img/loading.gif";
        hideElement(this.loadingElement);

        this.appendChild(
            this.backgroundPicture,
            this.backgroundOverlay,
            this.filter,
            this.playlistWidget,
            this.bottomBar,
            this.songMenu,
            this.playlistMenu,
            this.spectrum,
            this.loadingElement,
            this.renameDialog,
            this.playlistDialog
        );

        this.playlistWidget.container.setAttribute("tabIndex", "0");

        let ipcRenderer = require("electron").ipcRenderer;
        ipcRenderer.on("app-command", this.processAppCommand.bind(this));

        (window as any).mainPlayer = this;
        (window as any).RenameRule = RenameRule;

        this.init();
    }

    private init() : void
    {
        //console.time("all loaded");

        /*this.playlistWidget.loadFromPath("D:\\Google Drive\\Music", () =>
        {
            //console.timeEnd("all loaded");
        
            this.loadingElement.style.display = "none";
        });*/

        this.playlistWidget.on("loadstart", () =>
        {
            showElement(this.loadingElement);
        });

        this.playlistWidget.on("construct", () =>
        {
            hideElement(this.loadingElement);
        });

        this.playlistWidget.on("dblclick", (song : SongWidget, e : MouseEvent) =>
        {
            this.playSong(song, true);
        });

        this.playlistWidget.on("click", (song : SongWidget, e : MouseEvent) =>
        {
            // selection handled in songs.ts
        });

        this.playlistWidget.on("rightclick", (song : SongWidget, e : MouseEvent) =>
        {
            if (this.playlistWidget.currentSelection.length <= 1 || !array_contains(this.playlistWidget.currentSelection, song))
            {
                this.playlistWidget.select(song, true);
            }

            this.songMenu.show(e.clientX + 1, e.clientY + 1);
        });

        this.playlistWidget.container.addEventListener("keypress", e =>
        {
            if (e.which === 13) // enter
            {
                this.playSelected();
            }
            else
            {
                this.filter.value = "";
                this.filter.container.focus();
            }
        });

        this.playlistWidget.container.addEventListener("keydown", e =>
        {
            if (this.playlistWidget.currentSelection.length === 0)
            {
                return;
            }

            if (e.which === 38) // up
            {
                e.preventDefault();
                this.playlistWidget.shiftSelection(-1);
                element_scrollIntoViewIfNeeded(this.playlistWidget.currentSelection[0].container, "top", false);
            }
            else if (e.which === 40) // down
            {
                e.preventDefault();
                this.playlistWidget.shiftSelection(1);
                element_scrollIntoViewIfNeeded(array_last(this.playlistWidget.currentSelection).container, "bottom", false);
            }
        });

        this.player.on("songfinish", () =>
        {
            this.playNext();
        });
        
        this.player.on("load", () =>
        {
            this.spectrum.start(this.player.mediaElement);
        });

        this.player.on("listencount", () =>
        {
            // console.log("i'm dying");
            this.currentlyPlaying.item.metadata.plays++;
            Playlist.writeCache();
        });

        this.filter.onpreview = (filter) =>
        {
            // console.log("preview: " + filter);
            this.playlistWidget.playlist.previewFilter(filter, true);
        };

        this.filter.onfilter = (filter) =>
        {
            //console.log("filter: " + filter);
            this.playlistWidget.playlist.filter(filter);
        };

        this.bottomBar.hookPlayer(this.player);

        this.bottomBar.onplaypressed = () =>
        {
            if (!this.currentlyPlaying)
            {
                return this.playSelected();
            }

            let success = this.playSong(this.currentlyPlaying);
            return success;
        };

        this.bottomBar.onpausepressed = () =>
        {
            this.player.pause();
        };

        this.bottomBar.onnextpressed = () =>
        {
            this.playNext();
        };
        
        this.bottomBar.onpreviouspressed = () =>
        {
            this.playPrevious();
        };

        this.bottomBar.on("primaryclick", () =>
        {
            this.scrollToCurrent();
        });

        this.bottomBar.on("shuffleon", () =>
        {
            this.playlistWidget.playlist.shuffle();
        });

        this.bottomBar.on("shuffleoff", () =>
        {
            this.playlistWidget.playlist.unshuffle();
        });
    }

    /*private showPlaylists() : void
    {
        this.playlists.show();
        this.playlistWidget.container.style.width = "calc(100% - " + this.playlists.container.getBoundingClientRect().width + "px)";
    }

    private hidePlaylists() : void
    {
        this.playlists.hide();
        this.playlistWidget.container.style.width = "100%";
    }*/

    private promptRename() : void
    {
        // console.log("hey- o!!!");
        if (this.playlistWidget.currentSelection.length > 0)
        {
            // console.log("hHELP!!");
            this.renameDialog.show(this.playlistWidget.currentSelectionItems.filter(item => item instanceof Song).map(item => <Song>item));
        }
    }

    private editRules() : void
    {
        alert("coming soon,,,");
    }

    private revealInExplorer() : void
    {
        if (this.playlistWidget.currentSelection.length > 0)
        {
            revealInExplorer(this.playlistWidget.currentSelection[0].song.filename);
        }
    }

    private skipSongOnce() : void
    {
        this.skipOnceSongs.push(...this.playlistWidget.currentSelection);
        this.playlistWidget.currentSelection.forEach(song =>
        {
            song.container.classList.add("skipping");
        });
    }

    private removeFromPlaylist() : void
    {
        //this.playlistWidget.playlist.removeSongsFromPlaylist(...this.playlistWidget.currentSelectionSongs);   
    }

    private scrollToCurrent() : void
    {
        if (this.currentlyPlaying)
        {
            this.currentlyPlaying.container.scrollIntoView({
                behavior: "smooth"
            });
        }
    }

    private set backgroundSrc(src : string)
    {
        (this.backgroundPicture.style as any)["background-image"] = src;
    }

    private playSelected() : boolean
    {
        if (this.playlistWidget.currentSelection.length === 0)
        {
            return this.playSong(this.playlistWidget.renderedSongs[0]);
        }
        else if (this.playlistWidget.currentSelection.length === 1)
        {
            return this.playSong(this.playlistWidget.currentSelection[0]);
        }
        else if (this.playlistWidget.currentSelection.length > 1)
        {
            let fids = this.playlistWidget.currentSelection.map(itemWidget => "fid:" + i.fid);
            let filterString = fids.join("|");
            this.filter.removeAllFilters();
            this.filter.addFilter(filterString);
            return this.playSong(this.playlistWidget.firstItem);
        }
    }

    private playSong(song : SongWidget, restart : boolean = false) : boolean
    {
        if (!song)
        {
            return false;
        }

        if (array_remove_all(this.skipOnceSongs, song).existed)
        {
            song.container.classList.remove("skipping");
            return this.playSong(this.playlistWidget.songAfter(song));
        }

        let success = this.player.play(song.song.filename, restart);

        if (success)
        {
            if (this.currentlyPlaying)
            {
                if (this.currentlyPlaying === song)
                {
                    return true;
                }

                this.currentlyPlaying.container.classList.remove("playing");
            }

            this.currentlyPlaying = song;
            this.currentlyPlaying.container.classList.add("playing");

            this.bottomBar.primaryString = song.song.metadata.title;
            this.bottomBar.secondaryString = song.song.metadata.artist + " — " + song.song.metadata.album;

            // scroll

            this.backgroundSrc = "url(" + JSON.stringify(song.song.metadata.picture) + ")";
        }

        return success;
    }

    private stopSong() : void
    {
        this.player.stop();
        this.backgroundSrc = "";
        this.bottomBar.reset();
    }

    private playNext() : boolean
    {
        return this.playSong(this.playlistWidget.songAfter(this.currentlyPlaying));
    }

    private playPrevious() : void
    {
        if (this.player.currentTimeMs < 2000)
        {
            this.playSong(this.playlistWidget.songBefore(this.currentlyPlaying));
        }
        else
        {
            this.player.seekMs(0);
        }
    }

    private playPause() : void
    {
        this.bottomBar.playPause();
    }

    private processAppCommand(e : any, command : string) : void
    {
        switch (command)
        {
            case "media-nexttrack": this.playNext(); break;
            case "media-previoustrack": this.playPrevious(); break;
            case "media-play-pause": this.playPause(); break;
        }
    }
}