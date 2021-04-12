/* --------------------================-------------------- */
/*                      Graph Functions                     */
/* --------------------================-------------------- */

let data = {}

var uuidv4
if(uuidv4 == undefined) uuidv4 = () => String(Math.random()).slice(2)

let _usedcalc = null

class Stem {
    constructor(params = {}) {
        this.id = params.id || uuidv4()

        this.listeners = {}
        this.connections = []
    }

    listen(event, fn, immediate=false) {
        // if listener for event doesn't exist yet, create it
        this.listeners[event] = this.listeners[event] || []
        
        // push function to listener array
        this.listeners[event].push(fn)

        // run immediately if `immediate` is true
        if (immediate) fn.bind(this)()
    }

    addConnection(id) {
        this.connections.push(id)

        this.dispatch('connection', data[id])
        if(data[id].from == this.id) {
            this.dispatch('outgoingConnection', data[id])
        }else{
            this.dispatch('incomingConnection', data[id])
        }
    }

    dispatch(event, data) {
        (this.listeners[event] || []).forEach(fn => fn.bind(this)(data))
    }
}

class Node extends Stem {
    constructor(params = {}) {
        if(params.constructor !== Object) {
            super({})
            this.content = params
        } else {
            super(params)
            this.content = params.content || null
        }
    }

    set(content) {
        let prevContent = this.content

        this.content = content

        if(prevContent != this.content) this.dispatch('content', this.content)
    }

    get() {
        if(_usedcalc != null) _usedcalc.push(this)

        return this.content
    }

    remove() {
        ;[].slice.call(this.connections).forEach(connid => data[connid].remove())
        this.dispatch('remove', this)

        this.listeners = []
        delete data[this.id]
    }
}

class Connection extends Stem {
    constructor(a, b) {
        super({})

        this.a = a
        this.b = b

        this.from = a
        this.to = b
    }

    remove() {
        this.connections.forEach(connid => data[connid].remove())
        this.dispatch('remove', this)

        this.listeners = []

        let from = data[this.from]
        let to = data[this.to]

        from.dispatch('removeConnection', this)
        from.dispatch('removeOutgoingConnection', this)

        to.dispatch('removeConnection', this)
        to.dispatch('removeIncomingConnection', this)

        from.connections.splice(from.connections.indexOf(this.id), 1)
        to.connections.splice(to.connections.indexOf(this.id), 1)

        delete data[this.id]
    }
}

function createNode(params) {
    let node = new Node(params)
    data[node.id] = node
    return node
}

function createConnection(a, b) {
    // if IDs are provided, get their corresponding objects
    if (a.constructor == String) { a = data[a] }
    if (b.constructor == String) { b = data[b] }

    // create connection if objects have valid IDs (aka they are valid nodes/connections)
    if (a.id != null && b.id != null) {
        let connection = new Connection(a.id, b.id)
        data[connection.id] = connection

        // a.connections.push(connection.id)
        // b.connections.push(connection.id)

        a.addConnection(connection.id)
        b.addConnection(connection.id)

        return connection
    } else {
        console.error("Connection must be provided with two valid IDs or Nodes")
    }
}

function labelledConnection(a, b, label) {
    let connection = createConnection(a, b)

    createConnection(label, connection)

    return connection
}

function getNodesWithLabel(label) {
    if(label.constructor == String) { label = data[label] }

    return label.connections.filter(edge => data[edge].from == label.id).map(edge => data[data[edge].to])
}

function nodeToReactiveJSON(node) {
    if(node.constructor == String) { node = data[node] }

    let json = {}

    node.connections.forEach(edgeID => {
        let edge = data[edgeID]
        if(edge.from == node.id) {
            // console.log(edge.connections.map(id => data[id]))
            edge.connections.forEach(labelEdgeID => {
                let labelEdge = data[labelEdgeID]

                if(labelEdge.to == edge.id) {
                    let label = data[labelEdge.from]
                    json[label.content || label.id] = data[edge.to]
                }
            })
        }
    })

    return json
}

// function nodeToJSON(node) {
//     let json = nodeToReactiveJSON(node)

//     function parseLayer(layer) {
//         for(key in layer) {

//         }
//     }
// }

function watchMultiple(event, propNodes, fn) {
    let output = []

    // add listeners to each property
    propNodes.forEach(prop => {
        output.push(prop.content)

        prop.listen(event, function() {
            output[propNodes.indexOf(this)] = this.content
            fn(output)
        })
    })

    // call right away
    fn(output)
}

/* --------------------================-------------------- */
/*                    Utility  Functions                    */
/* --------------------================-------------------- */

function calc(fn) {
    let node = createNode()

    _usedcalc = []
    node.set(fn())

    watchMultiple("content", _usedcalc, () => {
        node.set(fn())
    })
    _usedcalc = null

    return node
}

// function marker() {
//     return document.createTextNode("")
// }

function map(label, fn, sort) {
    let fragment = new DocumentFragment()
    let marker = document.createTextNode("")
    fragment.appendChild(marker)

    let elements = [marker]

    label.listen('outgoingConnection', connection => {
        if(connection) {
            console.log(marker)
            let lastItem = elements[elements.length-1]
            let node = data[connection.to]
            let el = fn(node)
            el.dataset.id = node.id

            console.log("ELEMENTS", elements)

            node.elements = (node.elements||[]).concat(el)

            elements.push(el)
            lastItem.parentElement.insertBefore(el, lastItem.nextSibling)
        } else {
            console.log(label.connections)
            label.connections.filter(conn => data[conn].from == label.id).forEach(conn => {
                let node = data[data[conn].to]
                let el = fn(node)
                el.dataset.id = node.id

                elements.push(el)
                fragment.appendChild(el)
            })
        }
    }, true)

    label.listen('removeOutgoingConnection', connection => {
        let node = data[connection.to];
        (node.elements||[]).forEach(el => {
            if(elements.includes(el)) {
                elements.splice(elements.indexOf(el), 1)
                el.parentElement.removeChild(el)
            }
        })
    })

    return fragment
}

function $(selector) {
	return document.querySelector(selector);
}

function $$(selector) {
	return [].slice.call(document.querySelectorAll(selector));
}

let h, svg;
(function() {
	function _generateElement(args, el) {
		let e = null;
		let _tci = args.shift().split(/\s*(?=[.#])/); // tag, class, id
		if(/[.#]/.test(_tci[0])) e = el('div');
		_tci.forEach(function(v) {
			if(!e) e = el(v);
			else if(v[0] === '.') e.classList.add(v.slice(1));
			else if(v[0] === '#') e.setAttribute('id', v.slice(1));
		});
		function item(l) {
			switch (l.constructor) {
				case Array:
					l.forEach(item);
					break;
				case Object:
					for(let attr in l) {
						if(attr === 'style') {
							for(let style in l[attr]) {
                                let value = l[attr][style]
                                if(value.constructor == Node) {
                                    value.listen("content", () => e.style.setProperty(style, value.get()), true)
                                }else{
                                    e.style.setProperty(style, value);
                                }
							}
						}else if(attr.substr(0, 2) === 'on'){
                            let value = l[attr]
                            if(value.constructor == Node) console.error("h() does not yet support nodes as event listener callbacks")

                            let fn = value
                            let event = attr.substr(2).split('.')
                            
                            if(event[0].includes('key')) { // allow keydown.enter syntax ... :)
                                fn = ((k,e) => {
                                    if(k.map(key=>e.key.toLowerCase()===key.toLowerCase()).reduce((a,b)=>a||b)) {
                                        value(e)
                                    }
                                }).bind(null, event.slice(1))
                            }
							
                            e.addEventListener(event[0], fn);
						}else{
                            let setAttr = (attr, val) => {
                                if(attr === 'value') {
                                    e[attr] = val
                                } else {
                                    e.setAttribute(attr, val)
                                }
                            }

                            let value = l[attr]
                            if(value.constructor == Node) {
                                value.listen("content", () => setAttr(attr, value.get()), true)
                            }else{
                                setAttr(attr, l[attr]);
                            }
						}
					}
					break;
				default:
					if(l.nodeType != undefined) {
                        e.appendChild(l)
                    }else if(l.constructor == Node) {
                        let textNode = document.createTextNode(l.get())
                        l.listen("content", () => textNode.textContent = l.get())

                        e.appendChild(textNode)
                    }else{
                        e.appendChild(document.createTextNode(l))
                    }
			}
		}
		while(args.length > 0) {
			item(args.shift());
		}
		return e;
	}

	h = function() {
		return _generateElement([].slice.call(arguments), function(tagName) {
			return document.createElement(tagName);
		});
	}

	svg = function() {
		return _generateElement([].slice.call(arguments), function(tagName) {
			return document.createElementNS('http://www.w3.org/2000/svg', tagName);
		});
	}
})(); // h, svg


function bindinput(node) {
    return {
        'value': node,
        'oninput': function(e) { node.set(this.value) }
    }
}

function toggle(val, opts) {
    let fragment = new DocumentFragment()
    let marker = document.createTextNode("")
    fragment.appendChild(marker)

    let current;

    val.listen('content', () => {
        let parent = marker.parentNode;
        let index = typeof val.get() === 'boolean' ? val.get()+0 : val.get();

        const event = {
            'togglein': new Event('togglein'),
            'toggleout': new Event('toggleout')
        }

        if(current) {
            current.dispatchEvent(event.toggleout)
            parent.removeChild(current)
        }
        if(opts[index]) {
            parent.insertBefore(opts[index], marker.nextSibling)
            opts[index].dispatchEvent(event.togglein)
        }

        current = opts[index]
    }, true)

    return fragment
}