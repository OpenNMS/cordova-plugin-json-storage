//
//  ONMSCloudStorage.h
//  Cordova Cloud Storage Plugin
//
//  Created by Benjamin Reed on 7/20/15.
//
//

#import <Cordova/CDV.h>

@interface ONMSCloudStorage : CDVPlugin

- (void) onmsGetJsonFileContents:(CDVInvokedUrlCommand *)command;
- (void) onmsSetJsonFileContents:(CDVInvokedUrlCommand *)command;
- (void) onmsRemoveJsonFile:(CDVInvokedUrlCommand *)command;
- (void) onmsListJsonFiles:(CDVInvokedUrlCommand *)command;

#pragma mark - Internal

- (BOOL) writeFile:(NSString *)toPath withData:(NSData *)data error:(__autoreleasing NSError **)error;
- (NSData *) readFile:(NSString *)fromPath error:(__autoreleasing NSError **)error;
- (BOOL) removeFile:(NSString *)filePath error:(__autoreleasing NSError **)error;
- (NSString *) getFilePath:(NSString *)forPath;
- (NSArray *) readDirectory:(NSString *)path error:(__autoreleasing NSError **)error;

@end
