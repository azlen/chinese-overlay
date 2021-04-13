# Overlay Experiment

Experimenting with Jeffrie's (@progrium) [topframe](https://github.com/progrium/topframe) to create an overlay for learning chinese characters and keeping focus on my current task

## Instructions for installing

First install Go
```$ brew install go```

Then install topframe
```$ GOBIN=/usr/local/bin go get github.com/progrium/topframe```

Then clone this repo into `~/.topframe`
```git clone git@github.com:azlen/chinese-overlay.git ~/.topframe```

Launch on startup
```topframe -plist > ~/Library/LaunchAgents/com.progrium.Topframe.plist```