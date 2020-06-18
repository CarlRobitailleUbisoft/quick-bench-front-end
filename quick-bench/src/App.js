import React, { Component } from 'react';
import Benchmark from './QuickBenchmark.js';
import Header from 'components/Header.js';
import { Helmet } from "react-helmet";
import './App.css';
import 'components/Shared.css';
import Display from 'components/Display.js';
import { BrowserRouter, Route, Redirect } from 'react-router-dom';

const url = process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : window.location.origin;

const maxCodeSize = 20000;

const DEFAULT_DESCRIPTION = 'Quick-Bench is an online tool to easily create and run C++ micro-benchmarks using Google Benchmark API.';

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            location: null,
            prevlocation: null,
            description: DEFAULT_DESCRIPTION,
            stylePath: ''
        };
    }
    componentDidUpdate() {
        if (this.state.location !== this.state.prevlocation) {
            this.setState({
                prevlocation: this.state.location
            });
        }
    }
    changeMargin() {
        var all = document.getElementsByClassName('container-fluid');
        for (var i = 0; i < all.length; i++) {
            all[i].style.marginTop = this.header.clientHeight + 'px';
        }
    }
    redirect() {
        if (this.state.location !== this.state.prevlocation && this.state.location) {
            return (
                <Redirect push to={'/q/' + this.state.location} />
            );
        }
        return null;
    }
    setStyle(css) {
        this.setState({ stylePath: css });
    }

    Home = ({ match }) => <Benchmark onDisplay={() => this.changeMargin()} id={match.params ? match.params.id : null} url={url} maxCodeSize={maxCodeSize} onLocationChange={(l) => this.setState({ location: l })} onDescriptionChange={(d) => this.setState({ description: d ? d : DEFAULT_DESCRIPTION })} specialPalette={this.state.stylePath !== ''} />;

    render() {
        return (
            <BrowserRouter history={this.state.location}>
                <div className="App full-size">
                    <Helmet>
                        <meta name="twitter:card" content="summary" />
                        <meta name="twitter:site" content="@FredTingaudDev" />
                        <meta name="twitter:title" content="Quick C++ Benchmarks" />
                        <meta name="twitter:url" content="http://quick-bench.com/" />
                        <meta name="twitter:description" content={this.state.description} />
                        <meta property="og:type" content="website" />
                        <meta property="og:url" content="http://quick-bench.com/" />
                        <meta property="og:title" content="Quick C++ Benchmarks" />
                        <meta property="og:description" content={this.state.description} />
                        <Display when={this.state.stylePath}>
                            <link rel="stylesheet" type="text/css" href={process.env.PUBLIC_URL + '/css/' + this.state.stylePath} />
                        </Display>
                    </Helmet>
                    <div ref={div => { this.header = div; }}><Header setStyle={css => this.setStyle(css)} brand="Quick C++ Benchmark" /></div>
                    <Route exact path={["/", "/q/:id"]} component={this.Home} />
                    {this.redirect()}
                </div>
            </BrowserRouter>
        );
    }
}

export default App;