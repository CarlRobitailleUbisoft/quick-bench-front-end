import React from 'react';
import CodeEditor from 'components/CodeEditor.js';
import BashOutput from 'components/BashOutput.js';
import CompileConfig from 'components/CompileConfig.js';
import BuildChart from './BuildChart.js';
import { Button, ButtonToolbar, Row, Col, Container, Card, FormCheck, Form, ProgressBar, Nav, Tab } from 'react-bootstrap';
import { MdTimer } from "react-icons/md";
import OutputTabs from './OutputTabs.js';
import WrappableTabs from './WrappableTabs.js';
import DisplayEditor from './DisplayEditor.js';
import IncludesDisplay from './IncludesDisplay.js';
import Palette from 'components/Palette.js';

var request = require('request');
const protocolVersion = 3;

const startCode1 = `#include <cstdio>

int main() {
    puts("Hello World");
    return 0;
}
`;
const startCode2 = `#include <iostream>

int main() {
    std::cout << "Hello World\\n";
    return 0;
}
`;
const PALETTE = [
    "#e3a600",
    "#b8b600",
    "#75c500",
    "#00ca81",
    "#00c6b2",
    "#00c3d2",
    "#13bdff",
    "#a6a9ff",
    "#e390ff",
    "#ff86dc",
    "#ff8eaf",
    "#ff9470"
];

class Benchmark extends React.Component {
    static initialState = {
        texts: [startCode1, startCode2]
        , titles: ['cstdio', 'iostream']
        , graph: []
        , messages: ['', '']
        , sending: false
        , progress: 0
        , index: 0
        , options: Array(2).fill().map(a => ({
            compiler: "clang-9.0"
            , cppVersion: "20"
            , optim: "3"
            , lib: "gnu"
        }))
        , clean: false
        , force: false
        , chartIndex: 0
        , textsWrapped: false
        , optionsWrapped: true
        , includes: []
        , asm: []
        , pp: []
    }
    constructor(props) {
        super(props);
        this.state = JSON.parse(JSON.stringify(Benchmark.initialState));
        this.state.location = props.id;
        this.state.prevLocation = props.id;

        let stateFromHash = this.getStateFromHash();
        if (stateFromHash) {
            this.state.text = stateFromHash.text;
            if (stateFromHash.compiler) this.state.compiler = stateFromHash.compiler;
            if (stateFromHash.cppVersion) this.state.cppVersion = stateFromHash.cppVersion;
            if (stateFromHash.optim) this.state.optim = stateFromHash.optim;
            if (stateFromHash.lib) this.state.lib = stateFromHash.lib;
        }
    }
    initializeCode() {
        this.setState(Benchmark.initialState);
    }
    getStateFromHash() {
        if (window.location.hash) {
            let state = this.decodeHash(window.location.hash);
            window.location.hash = "";
            if (state.text) {
                return state;
            }
        }

        return false;
    }
    componentDidMount() {
        if (this.props.id) {
            this.clearResults();
            this.setState({
                sending: true,
                messages: []
            });
            this.getCode(this.props.id);
        }
        this.props.onDisplay();
    }
    componentDidUpdate(prevProps) {
        if (prevProps.id !== this.props.id) {
            this.setState({
                prevLocation: this.props.id
            });
            if (this.props.id !== this.state.location) {
                this.setState({
                    location: this.props.id
                });
                if (this.props.id) {
                    this.getCode(this.props.id);
                } else {
                    this.initializeCode();
                    this.props.onLocationChange(undefined);
                }
            }
        }
    }
    static getDerivedStateFromProps(props, state) {
        if (props.id !== state.prevLocation && props.id !== state.location && props.id) {
            return {
                sending: true,
                graph: [],
                messages: []
            };
        }
        return null;
    }
    bufferMap(buffers) {
        return (buffers || []).map(s => s ? Buffer.from(s).toString() : '');
    }
    formatIncludes(includes) {
        return includes.map(s => s.split('\n').map(s => {
            let end = false;
            return [...s].map(c => {
                if (c === '.' && !end)
                    return '\t'
                end = true;
                return c;
            }).join('').replace('\t ', '');
        }).join('\n'));
    }
    clearResults() {
        this.setState({
            graph: [],
            includes: [],
            asm: [],
            pp: [],
            index: 0
        });
    }
    getCode(id) {
        this.clearResults();
        request.get(this.props.url + '/build/' + id, (err, res, body) => {
            this.setState({
                sending: false,
                clean: true,
                force: false
            });
            if (body) {
                let result = JSON.parse(body);
                if (result) {
                    if (result.result) {
                        let titles = result.tabs.map(t => t.title);
                        let options = result.tabs.map(t => ({
                            compiler: t.compiler
                            , cppVersion: t.cppVersion
                            , optim: t.optim
                            , lib: t.lib
                        }));
                        this.setState({
                            texts: result.tabs.map(t => t.code)
                            , titles: titles
                            , graph: result.result
                            , options: options
                            , location: id
                            , textsWrapped: result.tabs.every(v => v.code === result.tabs[0].code)
                            , optionsWrapped: options.every(o => JSON.stringify(o) === JSON.stringify(options[0]))
                            , includes: this.formatIncludes(result.includes)
                            , asm: result.asm
                            , pp: result.preprocessed
                        });
                    }
                    if (result.messages) {
                        this.setState({
                            messages: result.messages
                        });
                    }
                }
            }
        });
    }
    sendCode() {
        const bigger = this.state.texts.findIndex(t => t.length > this.props.maxCodeSize);
        this.clearResults();
        if (bigger > -1) {
            this.setState({
                messages: [`Your code in ${this.state.titles[bigger]} is ${this.state.texts[bigger].length} characters long, while the maximum code size is ${this.props.maxCodeSize}.
If you think this limitation is stopping you in a legitimate usage of build-bench, please contact me.`]
            });
        } else {
            this.setState({
                sending: true,
                messages: []
            });
            this.setState({ progress: 0 });
            let interval = setInterval(() => {
                this.setState({ progress: this.state.progress + 100 / 120 });
            }, 1000);

            var obj = {
                "tabs": this.state.texts.map((c, i) => ({
                    "code": c,
                    "title": this.state.titles[i],
                    "compiler": this.state.options[i].compiler,
                    "optim": this.state.options[i].optim,
                    "cppVersion": this.state.options[i].cppVersion,
                    "lib": this.state.options[i].lib
                    , "asm": 'att'
                    , "withPP": true
                })),
                "protocolVersion": protocolVersion,
                "force": this.state.clean && this.state.force,
            };
            request({
                url: this.props.url + '/build/'
                , method: "POST"
                , json: true
                , headers: {
                    "content-type": "application/json"
                }
                , body: obj
            }, (err, res, body) => {
                this.setState({
                    sending: false,
                    clean: true,
                    force: false
                });
                clearInterval(interval);
                if (body) {
                    if (body.result) {
                        this.setState({
                            graph: body.result,
                            location: body.id,
                            includes: this.formatIncludes(this.bufferMap(body.includes)),
                            asm: this.bufferMap(body.asm),
                            pp: this.bufferMap(body.preprocessed)
                        });
                        this.props.onLocationChange(body.id);
                    }
                    if (body.messages) {
                        this.setState({ messages: body.messages });
                    }
                }
                else if (err) {
                    this.setState({ messages: err });
                }
            });
        }
    }
    compilerCeId(i) {
        if (this.state.options[i].compiler.startsWith('clang'))
            return 'clang' + this.state.options[i].compiler.substr(6).replace('.', '') + '0';
        return 'g' + this.state.options[i].compiler.substr(4).replace('.', '');
    }
    optimCe(i) {
        switch (this.state.options[i].optim) {
            case 'G':
                return '-Og';
            case 'F':
                return '-Ofast';
            case 'S':
                return '-Os';
            default:
                return '-O' + this.state.options[i].optim;
        }
    }
    versionCe(i) {
        switch (this.state.options[i].cppVersion) {
            case '20':
                return '2a';
            case '17':
                return '1z';
            default:
                return this.state.options[i].cppVersion;
        }
    }
    b64UTFEncode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, v) {
            return String.fromCharCode(parseInt(v, 16));
        }));
    }
    decodeHash(str) {
        try {
            let base64ascii = str.substr(1);
            if (base64ascii) {
                return JSON.parse(atob(base64ascii));
            }
        } catch (err) {
            console.error(err);
        }
        return false;
    }
    optionsCe(i) {
        const cppVersion = '-std=c++' + this.versionCe(i);
        return cppVersion + ' ' + this.optimCe(i);
    }
    openCodeInCE() {
        let sessions = this.state.texts.map((t, i) => ({
            "id": i,
            "language": "c++",
            "source": t,
            "compilers": [{
                "id": this.compilerCeId(i),
                "options": this.optionsCe(i),
                "libs": [{
                    "name": "benchmark",
                    "ver": "140"
                }]
            }]
        }));
        var clientstate = {
            "sessions": sessions
        };
        var link = window.location.protocol + '//godbolt.org/clientstate/' + this.b64UTFEncode(JSON.stringify(clientstate));
        window.open(link, '_blank');
    }
    setDirty() {
        this.setState({
            clean: false,
            force: false
        });
    }
    codeChanged(code) {
        this.setState({
            texts: code
        });
        this.setDirty();
    }
    forceChanged(e) {
        this.setState({
            force: e.target.checked
        });
    }
    onOptionsChange(options) {
        this.setState({ options: options });
        this.setDirty();
    }
    onTitlesChange(titles) {
        this.setState({ titles: titles });
        this.setDirty();
    }
    buttonHeight() {
        const run = document.getElementById('Run');
        if (run == null)
            return '5px';
        const compStyle = window.getComputedStyle(run, null);
        // We remove 4px more because for some reason otherwise it is possible that the CE button ends-up slightly bigger than the run button
        // Which because the whole toolbar is the same size, would start an infinit loop of 
        // "run" growing -> CE grows to react -> is bigger than run -> grows the toolbar
        return `calc(${compStyle.height} - ${compStyle.paddingTop} - ${compStyle.paddingBottom} - 4px)`;
    }
    closeTab(removedIndex) {
        let texts = this.state.texts;
        texts.splice(removedIndex, 1);
        let titles = this.state.titles;
        titles.splice(removedIndex, 1);
        let opts = this.state.options;
        opts.splice(removedIndex, 1);
        let messages = this.state.messages;
        this.setState({
            texts: texts,
            titles: titles,
            options: opts,
            messages: messages
        });

        this.setDirty();
    }
    addTab() {
        let texts = this.state.texts.concat(this.state.texts[this.state.index]);
        let titles = this.state.titles.concat(this.state.titles[this.state.index] + '2');
        let opts = this.state.options.concat({ ...this.state.options[this.state.index] });
        let messages = this.state.messages.concat('');
        this.setState({
            texts: texts,
            titles: titles,
            options: opts,
            messages: messages
        });

        this.setDirty();
    }
    render() {
        return (
            <Container fluid>
                <Row className="full-size">
                    <Col sm={6} className="full-size">
                        <div className="code-editor">
                            <WrappableTabs
                                titles={this.state.titles}
                                index={this.state.index}
                                setIndex={i => this.setState({ index: i })}
                                wrapped={this.state.textsWrapped}
                                changeWrapped={(w, c) => this.setState({ textsWrapped: w }, c)}
                                closeTab={(i) => this.closeTab(i)}
                                addTab={() => this.addTab()}
                                onTitlesChange={t => this.onTitlesChange(t)}
                                values={this.state.texts}
                                onChange={c => this.codeChanged(c)}
                                confirm
                                packed
                            >
                                <CodeEditor
                                    names={[]}
                                />
                            </WrappableTabs>
                        </div>
                    </Col>
                    <Col sm={6} className="flex-container">
                        <div className="fill-content">
                            <div className="fixed-content">
                                <Card body className="my-2">
                                    <WrappableTabs
                                        titles={this.state.titles}
                                        index={this.state.index}
                                        setIndex={i => this.setState({ index: i })}
                                        wrapped={this.state.optionsWrapped}
                                        changeWrapped={(w, c) => this.setState({ optionsWrapped: w }, c)}
                                        closeTab={(i) => this.closeTab(i)}
                                        addTab={() => this.addTab()}
                                        onTitlesChange={t => this.onTitlesChange(t)}
                                        values={this.state.options}
                                        onChange={c => this.onOptionsChange(c)}
                                        unwrapText="Configure Separately"
                                    >
                                        <CompileConfig />
                                    </WrappableTabs>
                                    <hr className="config-separator" />
                                    <ButtonToolbar className="justify-content-between">
                                        <Form inline>
                                            <Button variant="primary" onClick={() => this.sendCode()} disabled={this.state.sending} className="mr-2" id="Run"> <MdTimer /> Build Time</Button>
                                            {this.state.clean ? <FormCheck ref="force" type="checkbox" custom checked={this.state.force} id="clean-cache" onChange={this.forceChanged.bind(this)} label="Clear cached results" /> : null}
                                        </Form>
                                        <Form inline>
                                            <Button variant="outline-dark" onClick={() => this.openCodeInCE()} className="float-right"><img src="/ico/Compiler-Explorer.svg" style={{ height: "1em" }} alt="Open in Compiler Explorer" /></Button>
                                        </Form>
                                    </ButtonToolbar>
                                    {this.state.sending ? <ProgressBar animated now={this.state.progress} /> : null}
                                </Card>
                            </div>
                            <Tab.Container defaultActiveKey="charts">
                                {this.state.graph.length > 0 ? (
                                    <Nav variant="tabs">
                                        <Nav.Item>
                                            <Nav.Link eventKey="charts">Charts</ Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link eventKey="includes">Includes</ Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link eventKey="asm">Assembly</ Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link eventKey="pp">Preprocessed</ Nav.Link>
                                        </Nav.Item>
                                    </Nav>
                                ) : null}
                                <Tab.Content className="fill-content">
                                    <Tab.Pane eventKey="charts" className="fill-content">
                                        <BuildChart benchmarks={this.state.graph}
                                            id={this.state.location}
                                            titles={this.state.titles}
                                            index={this.state.chartIndex}
                                            onDescriptionChange={d => this.props.onDescriptionChange(d)}
                                            palette={this.props.specialPalette ? Palette.CHRISTMAS_PALETTE : PALETTE}
                                            changeDisplay={d => this.setState({ chartIndex: d })}
                                        />
                                    </Tab.Pane>
                                    <Tab.Pane eventKey="includes" className="fill-content" >
                                        <OutputTabs values={this.state.includes} index={this.state.index} setIndex={i => this.setState({ index: i })} titles={this.state.titles}>
                                            <IncludesDisplay />
                                        </OutputTabs>
                                    </Tab.Pane>
                                    <Tab.Pane eventKey="asm" className="fill-content">
                                        <OutputTabs values={this.state.asm} index={this.state.index} setIndex={i => this.setState({ index: i })} titles={this.state.titles}>
                                            <DisplayEditor language="asm" />
                                        </OutputTabs>
                                    </Tab.Pane>
                                    <Tab.Pane eventKey="pp" className="fill-content">
                                        <OutputTabs values={this.state.pp} index={this.state.index} setIndex={i => this.setState({ index: i })} titles={this.state.titles}>
                                            <DisplayEditor language="cpp" />
                                        </OutputTabs>
                                    </Tab.Pane>
                                </Tab.Content>
                            </Tab.Container>
                            <div className="fixed-content">
                                <OutputTabs values={this.state.messages} index={this.state.index} setIndex={i => this.setState({ index: i })} titles={this.state.titles} >
                                    <BashOutput />
                                </OutputTabs>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Container>
        );
    }
}

export default Benchmark;