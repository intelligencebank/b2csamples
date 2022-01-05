/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import React, { useState } from "react";

import axios from 'axios';

import { useMsal } from "@azure/msal-react";

import {  ButtonGroup, Button, Table } from "react-bootstrap";

import { b2cPolicies, deployment } from "./authConfig";
import { useEffect } from "react";

export const Tenant = () => {
    const [nowShowing, setState] = useState("claims");    
    const { instance, accounts } = useMsal();
    let options = [["claims","Claims"], ["members", "Members"], ["invitation", "Invite someone"]].filter(role).map((v) => 
        <Button onClick={() => setState(v[0])}>{v[1]}</Button>
    );
    function role(option) {
        if(option[0] === "invitation")
            if (accounts[0].idTokenClaims.roles.includes("admin")) return true; else return false;
        return true;
    }
    return (
        <>
            <div>
                <ButtonGroup className="mb-2">
                    {options}
                </ButtonGroup>                      
            </div>
            {nowShowing === "claims"?
                <IdTokenContent />
                :
                (nowShowing === "members")?
                    <Members instance = {instance} account = {accounts[0]}/>
                    :
                    <InviteMember />
            }            
        </>
    );
}

const IdTokenContent = () => {
    const { accounts } = useMsal();
    const [idTokenClaims, setIdTokenClaims] = useState(accounts[0].idTokenClaims);
    return (
        <>
                <IdTokenClaims idTokenClaims={idTokenClaims} />
        </>
    );
};

const IdTokenClaims = (props) => {  
    return (
        <div id="token-div">
            <p><strong>Sign in name: </strong> {props.idTokenClaims.signInName}</p>               
            <p><strong>Email: </strong> {props.idTokenClaims.email}</p>            
            <p><strong>SUB: </strong> {props.idTokenClaims.sub}</p>
            <p><strong>UPN: </strong> {props.idTokenClaims.preferred_username}</p>
            <p><strong>App tenant: </strong> {props.idTokenClaims.appTenantName}</p>
            <p><strong>App tenant id: </strong> {props.idTokenClaims.appTenantId}</p>
            <p><strong>Roles: </strong> {props.idTokenClaims.roles}</p>
        </div>
    );
}

const InviteMember = () => {
    const [email, setEmail] = useState("abc@xyz.com");
    const [invitation, setInvitation] = useState(null);
    const [statusMsg, setStatusMsg] = useState("");
    const { instance, accounts } = useMsal();    
    return (
        <div>
            <h5 className="card-title">Invitation</h5>
            <div>
                <div><p><i>Enter email address</i></p></div>                
                <div><input type="text" value={email} onChange={(e) => { setEmail(e.target.value); setInvitation(""); setStatusMsg(""); }}/></div>
                <div><Button onClick={() => 
                    {
                        console.log('starting click' + email);
                        setStatusMsg("generating");
                        //setEmail(email);
                        setInvitation("");
                        let request = { 
                            authority:b2cPolicies.authorities.signIn.authority,
                            scopes: ["openid", "profile", `https://${deployment.b2cTenantName}.onmicrosoft.com/mtrest/User.Invite`, `https://${deployment.b2cTenantName}.onmicrosoft.com/mtrest/User.ReadAll`],
                            account: accounts[0],
                            extraQueryParameters: { tenant: accounts[0].idTokenClaims.appTenantName }
                        }
                        instance.acquireTokenSilent(request).then(function(accessTokenResponse) {
                            console.log("Email:"+email);
                            let accessToken = accessTokenResponse.accessToken;
                            axios.post(
                                `${deployment.restUrl}tenant/oauth2/invite`,
                                { inviteEmail: email },
                                { headers: { 'Authorization': `Bearer ${accessToken}`} }
                              ).then(response => { setInvitation(response.data); console.log("invite received");})
                              .catch(error => console.log(error));
                        }).catch(function (error) {
                            if (error instanceof InteractionRequiredAuthError) {
                                instance.acquireTokenPopup(request).then(function(accessTokenResponse) {
                                    let accessToken = accessTokenResponse.accessToken;
                                    callApi(accessToken);
                                }).catch(function(error) {
                                    console.log(error);
                                });
                            }
                            console.log(error);
                        });
                    }}>Invite</Button></div>
                {invitation?
                    <Table bordered="true">
                        <tbody>
                            <a href={invitation} target="_blank" rel="noopener">Invitation url</a>
                        </tbody>
                    </Table>
                :statusMsg?
                    <p>Generating invitation link, please wait...</p>                    
                :
                    <p/>
                }       
            </div>
         </div>
    );
};

const Members = (props)  => {
        console.log("Members: " + props);

        const [members, setMembers] = useState(null);
        const { instance, accounts } = useMsal(); 
        const account = accounts[0];   

        const getMembers = (accessToken) => {
            console.log("Starting getMembers");
            axios.get(
                `${deployment.restUrl}tenant/oauth2/members`,
                { headers: { 'Authorization': `Bearer ${accessToken}`} }
            )
            .then(response => { 
                console.log(`${response.data.length} members received`); 
                setMembers(response.data)
             })
            .catch(error => console.log(error));             
        }

        useEffect(() => {
            let request = { 
                authority: `https://${deployment.b2cTenantName}.b2clogin.com/${deployment.b2cTenantId}/${account.idTokenClaims.acr}`,
                scopes: ["openid", "profile", `https://${deployment.b2cTenantName}.onmicrosoft.com/mtrest/User.Invite`, `https://${deployment.b2cTenantName}.onmicrosoft.com/mtrest/User.ReadAll`],
                account: accounts[0],
                extraQueryParameters: { tenant: account.idTokenClaims.appTenantName }
            };
            instance.acquireTokenSilent(request).then(function(accessTokenResponse) {
                getMembers(accessTokenResponse.accessToken);
            }).catch(function (error) {
                if (error instanceof InteractionRequiredAuthError) {
                    instance.acquireTokenPopup(request).then(function(accessTokenResponse) {
                        getMembers(accessTokenResponse.accessToken);
                    }).catch(function(error) {
                        console.log(error);
                    });
                }
                console.log(error);
            });
        },[]) 
        

        return (
            <>
            {members? 
                <div>
                    <h5 className="card-title">{`Tenant: ${account.idTokenClaims.appTenantName} has ${members.length} members`}</h5>
                    <Table>
                        <thead>
                            <tr key="ix">
                                <th>Email</th>
                                <th>Name</th>
                                <th>Roles</th>
                            </tr>
                        </thead>    
                        <tbody>
                            { listMembers(members) }   
                        </tbody>                                
                    </Table>
                </div>
            :
                <p>Loading, please wait...</p>
            }
            </>

        )
    };

    const listMembers = (members) => {
        console.log("listMembers");
        return (members.map((m, ix) =>
            <tr key="0">
                <td>{m.email}</td>
                <td>{m.name}</td>
                <td>{m.roles.toString()}</td>
            </tr>
        ))
    }

