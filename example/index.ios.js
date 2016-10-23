'use-strict'

/* base libs */
import './shim'
import Bitcoin from 'react-native-bitcoinjs-lib'
import React, { Component, PropTypes } from 'react'
import {
  View,
  Text,
  StyleSheet,
  AppRegistry,
  TouchableOpacity,
} from 'react-native'

export default class RNBitcoinJSExample extends Component {

  constructor(props) {
    super(props)

    this.state = {
      address: '',
    }

    this.generateNewAddress = this.generateNewAddress.bind(this)
  }

  generateNewAddress = () => {
    const keypair = Bitcoin.ECPair.makeRandom()
    this.setState({address: keypair.getAddress()})
  }

  render() {
    return(
      <View style={styles.container}>
        <Text style={styles.title}>React Native</Text>
        <Text style={[styles.title, {marginBottom: 150}]}>Bitcoin Wallet</Text>
        <TouchableOpacity onPress={this.generateNewAddress} style={styles.button}>
          <Text style={styles.buttonText}>Generate new address</Text>
        </TouchableOpacity>
        <Text style={styles.address}>{this.state.address}</Text>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,    
    padding: 10,
    alignItems: 'center',    
    justifyContent: 'center',
  },
  title: {
    padding: 8,
    fontSize: 18,    
    fontWeight: '900',
  },
  button: {
    width: 200,
    borderRadius: 4,
    marginBottom: 25,    
    paddingVertical: 8,
    alignItems: 'center',
    paddingHorizontal: 20,        
    justifyContent: 'center',
    backgroundColor: '#00cc44',
  },
  buttonText: {
    color: '#fff',
  },
  address: {
    flex: 1,
    fontSize: 15,    
    color: '#b5b5b5',
    fontWeight: '600',
    textAlign: 'center',
  }
})

AppRegistry.registerComponent('RNBitcoinJSExample', () => RNBitcoinJSExample);
